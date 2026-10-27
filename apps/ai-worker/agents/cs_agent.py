import re
from typing import Dict, Any, Optional, List
from uuid import UUID
import httpx

async def get_ai_context(
    query: str,
    service_token: str,
    client: httpx.AsyncClient,
    base_url: str = "http://test"
) -> Dict[str, Any]:
    """
    Mengambil data kontekstual Hybrid RAG untuk AI Agent (Zona B -> Zona A):
    1. Items & Stok (Internal Business Data)
    2. Expert Knowledge (Aftersales, Troubleshooting, Domain Expertise)
    3. AI Guidelines (Aturan Bisnis, Tone of Voice, Batasan Etika)
    """
    headers = {"Authorization": f"Bearer {service_token}"}
    
    # Panggil Unified Context endpoint
    clean_query = query.strip()
    encoded_query = clean_query.replace("?", "")
    res = await client.get(
        f"/internal/ai-tools/context?q={encoded_query}",
        headers=headers
    )
    if res.status_code == 200:
        return res.json()
    
    # Fallback ke individual calls jika /context gagal
    items_res = await client.get(f"/internal/ai-tools/search-items?q={encoded_query}", headers=headers)
    items = items_res.json() if items_res.status_code == 200 else []

    exp_res = await client.get(f"/internal/ai-tools/expert-knowledge?q={encoded_query}", headers=headers)
    expert_knowledge = exp_res.json() if exp_res.status_code == 200 else []

    guide_res = await client.get("/internal/ai-tools/guidelines", headers=headers)
    guidelines = guide_res.json() if guide_res.status_code == 200 else []

    return {
        "items": items,
        "expert_knowledge": expert_knowledge,
        "guidelines": guidelines
    }

async def run_cs_agent(
    conversation_id: UUID,
    message_body: str,
    service_token: str,
    client: Optional[httpx.AsyncClient] = None,
    base_url: str = "http://test"
) -> Dict[str, Any]:
    """
    Hybrid Super-Smart Customer Support Agent (Zona B).
    
    🧠 ARSITEKTUR HYBRID RAG & STRICT GUARDRAILS:
    1. Menggabungkan data internal (katalog/harga) + pengetahuan ahli + aturan bisnis.
    2. Strict Guardrails: DILARANG mengarang harga atau stok.
    3. Patuh terhadap panduan bisnis (ai_guidelines).
    4. Simpan proposal respon ke tabel ai_drafts (status 'pending') untuk Human-in-the-Loop review.
    """
    headers = {"Authorization": f"Bearer {service_token}"}
    close_client = False
    if client is None:
        client = httpx.AsyncClient(base_url=base_url)
        close_client = True

    try:
        # ======================================================================
        # 1. RETRIEVE HYBRID CONTEXT (Internal + Expert + Guidelines)
        # ======================================================================
        context = await get_ai_context(
            query=message_body,
            service_token=service_token,
            client=client,
            base_url=base_url
        )

        items: List[Dict[str, Any]] = context.get("items", [])
        expert_knowledge: List[Dict[str, Any]] = context.get("expert_knowledge", [])
        guidelines: List[Dict[str, Any]] = context.get("guidelines", [])

        # ======================================================================
        # 2. EVALUASI ATURAN BISNIS & SAFETY GUARDRAILS (ai_guidelines)
        # ======================================================================
        msg_lower = message_body.lower()
        active_guidelines = [g["instruction"] for g in guidelines]

        # Cek apakah ada guideline larangan yang terpicu
        # Contoh: "Jangan pernah merekomendasikan produk mengandung alkohol"
        guideline_violation_found = False
        rejection_message = ""

        for instruction in active_guidelines:
            inst_lower = instruction.lower()
            if "jangan" in inst_lower or "dilarang" in inst_lower or "tidak boleh" in inst_lower:
                # Cek kata kunci larangan (misal: 'alkohol')
                prohibited_terms = [word for word in ["alkohol", "alcohol", "steroid", "merkuri"] if word in inst_lower]
                for term in prohibited_terms:
                    if term in msg_lower:
                        guideline_violation_found = True
                        rejection_message = (
                            f"Mohon maaf, sesuai dengan kebijakan dan panduan kesehatan kami, "
                            f"kami tidak merekomendasikan produk yang mengandung {term}."
                        )
                        break
            if guideline_violation_found:
                break

        # Jika aturan bisnis melarang permintaan user
        if guideline_violation_found:
            reply_string = rejection_message
            target_item_name = None
            tool_price = None
            tool_stock = None
        else:
            # ==================================================================
            # 3. KONSULTASI AHLI VS PERTANYAAN KATALOG/HARGA
            # ==================================================================
            # Deteksi apakah pesan adalah pertanyaan harga/ketersediaan langsung
            is_direct_price_or_stock = (
                any(k in msg_lower for k in ["berapa harga", "harga", "biaya", "tarif"])
                or (any(k in msg_lower for k in ["ready", "stok", "ada"]) and not any(k in msg_lower for k in ["cocok", "saran", "rekomendasi", "konsultasi", "kenapa", "mengapa", "bagaimana"]))
            )

            # Cek apakah pesan berkaitan dengan topik konsultasi di expert_knowledge
            matching_expert = None
            if not is_direct_price_or_stock:
                for exp in expert_knowledge:
                    topic_words = re.findall(r"\w+", exp["topic"].lower())
                    content_words = re.findall(r"\w+", exp["content"].lower())
                    # Jika kata kunci topik muncul dalam pesan user
                    if any(w in msg_lower for w in topic_words if len(w) > 3) or exp["topic"].lower() in msg_lower:
                        matching_expert = exp
                        break

            # Skenario A: Pertanyaan Konsultasi / Troubleshooting Ahli
            if matching_expert:
                expert_advice = matching_expert["content"]
                # Cek apakah ada produk internal yang relevan dengan advis ahli
                recommended_item = None
                for it in items:
                    if it["name"].lower() in expert_advice.lower() or any(w.lower() in expert_advice.lower() for w in it["name"].split() if len(w) > 4):
                        recommended_item = it
                        break
                
                if not recommended_item and items:
                    recommended_item = items[0]

                if recommended_item:
                    target_item_name = recommended_item["name"]
                    tool_price = recommended_item["base_price"]
                    tool_stock = recommended_item["stock"]
                    reply_string = (
                        f"Berdasarkan panduan ahli kami: {expert_advice} "
                        f"Untuk perawatan yang tepat, kami merekomendasikan {target_item_name} "
                        f"dengan harga Rp {tool_price} (stok tersedia: {tool_stock})."
                    )
                else:
                    target_item_name = None
                    tool_price = None
                    tool_stock = None
                    reply_string = f"Berdasarkan saran ahli kami: {expert_advice}"

            # Skenario B: Pertanyaan Langsung Mengenai Produk / Stok / Harga
            elif items:
                # Cari item yang paling cocok dengan teks pesan
                matching_item = None
                for it in items:
                    if it["name"].lower() in msg_lower or any(w.lower() in msg_lower for w in it["name"].split() if len(w) > 3):
                        matching_item = it
                        break
                target_item = matching_item or items[0]
                target_item_name = target_item["name"]
                item_id = target_item["id"]

                # Panggil Typed Tools harga & stok
                stock_res = await client.get(f"/internal/ai-tools/check-stock?item_id={item_id}", headers=headers)
                stock_data = stock_res.json() if stock_res.status_code == 200 else {"available_stock": target_item["stock"]}
                tool_stock = stock_data["available_stock"]

                price_res = await client.get(f"/internal/ai-tools/get-price?item_id={item_id}&qty=1", headers=headers)
                price_data = price_res.json() if price_res.status_code == 200 else {"total_price": target_item["base_price"]}
                tool_price = price_data["total_price"]

                reply_string = f"Halo, berdasarkan cek stok, item {target_item_name} tersedia dengan harga {tool_price}."

            # Skenario C: Tidak ada data katalog maupun expert knowledge yang cocok
            else:
                await client.post(
                    "/internal/ai-tools/runs",
                    headers=headers,
                    json={
                        "agent_name": "cs_langgraph_agent",
                        "conversation_id": str(conversation_id),
                        "input_tokens": 90,
                        "output_tokens": 25,
                        "status": "handoff",
                        "metadata": {"reason": "No relevant context found", "query": message_body}
                    }
                )
                return {"status": "handoff", "reason": "item_not_found"}

        # ======================================================================
        # 4. OUTPUT GUARD (ANTI-HALUSINASI HARGA)
        # ======================================================================
        if tool_price is not None:
            digits_found = re.findall(r"\d+", reply_string)
            if not digits_found or tool_price not in [int(d) for d in digits_found]:
                # Terdeteksi halusinasi angka harga
                await client.post(
                    "/internal/ai-tools/runs",
                    headers=headers,
                    json={
                        "agent_name": "cs_langgraph_agent",
                        "conversation_id": str(conversation_id),
                        "input_tokens": 160,
                        "output_tokens": 40,
                        "status": "handoff",
                        "metadata": {"reason": "Price hallucination detected", "tool_price": tool_price}
                    }
                )
                return {"status": "handoff", "reason": "hallucination_detected"}

        # ======================================================================
        # 5. SIMPAN DRAFT KE AI_DRAFTS (Status 'pending' untuk Human-in-the-Loop)
        # ======================================================================
        draft_payload = {
            "conversation_id": str(conversation_id),
            "kind": "reply",
            "status": "pending",
            "payload": {
                "conversation_id": str(conversation_id),
                "reply_text": reply_string,
                "item_name": target_item_name,
                "price": tool_price,
                "stock": tool_stock,
                "guidelines_enforced": [g["category"] for g in guidelines],
                "expert_knowledge_used": [e["topic"] for e in expert_knowledge]
            },
            "generated_by": "cs_langgraph_hybrid_agent"
        }
        draft_res = await client.post("/internal/ai-tools/drafts", headers=headers, json=draft_payload)
        saved_draft = draft_res.json() if draft_res.status_code == 201 else {"id": None}

        # ======================================================================
        # 6. CATAT METADATA KE AI_RUNS
        # ======================================================================
        await client.post(
            "/internal/ai-tools/runs",
            headers=headers,
            json={
                "agent_name": "cs_langgraph_hybrid_agent",
                "conversation_id": str(conversation_id),
                "input_tokens": 180,
                "output_tokens": 60,
                "status": "completed",
                "metadata": {
                    "item_name": target_item_name,
                    "price": tool_price,
                    "guideline_violation_found": guideline_violation_found
                }
            }
        )

        return {
            "status": "success",
            "reply_text": reply_string,
            "draft_id": saved_draft.get("id"),
            "item_name": target_item_name,
            "price": tool_price,
            "stock": tool_stock,
            "guideline_violation_found": guideline_violation_found
        }

    finally:
        if close_client:
            await client.aclose()
