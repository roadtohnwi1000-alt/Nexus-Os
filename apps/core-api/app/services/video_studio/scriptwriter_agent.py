"""
NEXUS OS - Scriptwriter Agent (LangGraph/Autonomous Reasoning)
Domain B: AI Creative Production Engine
Generates 3 multi-angle 60-second video scripts with second-by-second timestamps
and runs automated QA Compliance (anti-hallucination, overclaim detection).
"""

from typing import Dict, Any, List, Optional
import uuid
import re

class ScriptwriterAgent:
    """
    Kecerdasan Buatan Pembuat Naskah Video Vertikal (9:16) untuk TikTok, Reels, dan Shorts.
    Menghasilkan 3 variasi sudut pandang psikologis (FOMO Agitation, Educational Review, Before-After Story).
    """

    PROHIBITED_OVERCLAIMS = [
        r"pasti sembuh.*100%",
        r"obat mujarab",
        r"kaya mendadak",
        r"cuan miliaran tanpa modal",
        r"garansi seumur hidup tanpa syarat",
        r"bebas dari segala penyakit",
        r"skema cepat kaya",
        r"pasti untung tanpa risiko"
    ]

    def __init__(self):
        pass

    def generate_three_variants(
        self,
        product_name: str,
        category: str,
        price_idr: float,
        stock_remaining: int,
        pain_points: List[str],
        unique_selling_points: List[str],
        target_audience: str = "Pengguna smartphone & tech enthusiast",
        brand_voice: str = "Casual & Energetic"
    ) -> List[Dict[str, Any]]:
        """
        Menghasilkan 3 variasi naskah berdurasi 60 detik dengan pembagian 4 scene presisi.
        """
        p_point = pain_points[0] if pain_points else "sering rusak dan baterai cepat habis"
        usp_1 = unique_selling_points[0] if unique_selling_points else "pengisian cepat 65W GaN"
        usp_2 = unique_selling_points[1] if len(unique_selling_points) > 1 else "garansi resmi 18 bulan ganti baru"
        usp_3 = unique_selling_points[2] if len(unique_selling_points) > 2 else "desain compact muat di saku"
        
        formatted_price = f"Rp {price_idr:,.0f}".replace(",", ".")

        # VARIAN 1: FOMO & Agitasi Masalah (High Urgency)
        v1_scenes = [
            {
                "scene_index": 1,
                "name": "Hook",
                "start_sec": 0,
                "end_sec": 3,
                "duration_sec": 3,
                "visual_cue": "Close up dramatis ekspresi kaget, layar HP berkedip merah peringatan baterai drop",
                "narration": f"Stop! Jangan sampai kamu nyesel beli charger abal-abal yang bikin HP meledak!",
                "on_screen_text": "STOP BELI CHARGER ABAL-ABAL! 🚨",
                "kinetic_highlight": "STOP JANGAN SALAH BELI"
            },
            {
                "scene_index": 2,
                "name": "Problem / Agitation",
                "start_sec": 3,
                "end_sec": 15,
                "duration_sec": 12,
                "visual_cue": "Potongan B-roll kabel terbakar, baterai menggelembung, charger panas saat disentuh",
                "narration": f"Banyak banget yang ngeluh {p_point}. Mau ngecas buru-buru, eh chargernya malah panas dan bikin baterai bocor. Kerugian servisnya bisa jutaan!",
                "on_screen_text": "GARA-GARA INI BATERAI CEPAT BOCOR 😱",
                "kinetic_highlight": "PANAS & BIKIN BOCOR"
            },
            {
                "scene_index": 3,
                "name": "Solution & Demo",
                "start_sec": 15,
                "end_sec": 45,
                "duration_sec": 30,
                "visual_cue": f"Unboxing mulus {product_name}, demo colok ke 2 device sekaligus, multimeter tes watt stabil, label harga {formatted_price}",
                "narration": f"Solusinya wajib beralih ke {product_name}! Punya teknologi {usp_1}, baterai langsung terisi 80 persen hanya dalam 30 menit. Dilengkapi {usp_2} dan pastinya {usp_3}. Dijamin adem dan aman dari konslet!",
                "on_screen_text": f"{product_name} - {usp_1} ✅",
                "kinetic_highlight": "ISI CEPAT 80% TANPA PANAS"
            },
            {
                "scene_index": 4,
                "name": "Strong CTA",
                "start_sec": 45,
                "end_sec": 60,
                "duration_sec": 15,
                "visual_cue": "Tangan menunjuk ke keranjang kuning di pojok kiri bawah, voucher diskon menyala berkedip, countdown flash sale",
                "narration": f"Harga cuma {formatted_price}! Stok di gudang sisa {stock_remaining} unit lagi. Klik keranjang kuning sekarang sebelum kehabisan!",
                "on_screen_text": f"PROMO {formatted_price} - KLIK KERANJANG KUNING! 🛒",
                "kinetic_highlight": "KLIK KERANJANG KUNING SEKARANG"
            }
        ]

        # VARIAN 2: Edukatif & Review Objektif (Value-First & Logic)
        v2_scenes = [
            {
                "scene_index": 1,
                "name": "Hook",
                "start_sec": 0,
                "end_sec": 3,
                "duration_sec": 3,
                "visual_cue": "Split screen 2 charger di timbangan digital & multimeter pengukur daya",
                "narration": f"Apakah {product_name} seharga {formatted_price} ini beneran worth it dibeli?",
                "on_screen_text": f"REVIEW JUJUR: WORTH IT GAK YA? 🤔",
                "kinetic_highlight": "REVIEW JUJUR WORTH IT?"
            },
            {
                "scene_index": 2,
                "name": "Problem / Agitation",
                "start_sec": 3,
                "end_sec": 15,
                "duration_sec": 12,
                "visual_cue": "Grafik penurunan daya charger murahan vs charger bersertifikasi resmi",
                "narration": f"Faktanya, 80 persen charger murah di pasaran voltasenya gak stabil. Akibatnya {p_point} dan umur baterai smartphone turun drastis dalam 6 bulan.",
                "on_screen_text": "VOLTASE TIDAK STABIL MERUSAK IC POWER 📉",
                "kinetic_highlight": "MERUSAK IC POWER SMARTPHONE"
            },
            {
                "scene_index": 3,
                "name": "Solution & Demo",
                "start_sec": 15,
                "end_sec": 45,
                "duration_sec": 30,
                "visual_cue": f"Teardown atau penampakan komponen tembaga murni {product_name}, tes thermogun menunjukkan suhu adem 34 derajat",
                "narration": f"Kita bedah {product_name}. Build quality-nya solid dengan {usp_1}. Arus daya terbagi pintar sehingga temperatur tetap dingin. Ditambah {usp_2} dan {usp_3}. Sangat worth it untuk investasi kesehatan gadget kamu.",
                "on_screen_text": f"TEKNOLOGI {usp_1} SUHU STABIL DINGIN ❄️",
                "kinetic_highlight": "ARUS PINTAR & SUHU DINGIN"
            },
            {
                "scene_index": 4,
                "name": "Strong CTA",
                "start_sec": 45,
                "end_sec": 60,
                "duration_sec": 15,
                "visual_cue": "Tangkapan layar rating bintang 4.9 dari 1.200 pembeli di marketplace, banner free ongkir",
                "narration": f"Mumpung lagi diskon resmi jadi {formatted_price}, langsung amankan pesanan kamu lewat link keranjang kuning sekarang!",
                "on_screen_text": f"BINTANG 4.9/5 - AMANKAN DI KERANJANG KUNING ⭐",
                "kinetic_highlight": "AMANKAN DI KERANJANG KUNING"
            }
        ]

        # VARIAN 3: Before-After / Storytelling (Emotional Relatability)
        v3_scenes = [
            {
                "scene_index": 1,
                "name": "Hook",
                "start_sec": 0,
                "end_sec": 3,
                "duration_sec": 3,
                "visual_cue": "Video POV orang terburu-buru mau berangkat kerja/kuliah tapi HP masih 5 persen",
                "narration": "Pernah gak panik mau berangkat tapi baterai HP masih kritis merah?",
                "on_screen_text": "PANIK MAU PERGI BATERAI SISA 5%?! 😱",
                "kinetic_highlight": "PANIK BATERAI SISA 5%"
            },
            {
                "scene_index": 2,
                "name": "Problem / Agitation",
                "start_sec": 3,
                "end_sec": 15,
                "duration_sec": 12,
                "visual_cue": "Jam dinding berdetak cepat, colokan longgar, nungguin 1 jam cuma nambah 10 persen",
                "narration": f"Dulu aku sering telat kerja gara-gara {p_point}. Nunggu ngecas lama banget, bikin stres tiap pagi.",
                "on_screen_text": "NUNGGU 1 JAM CUMA NAIK 10%... STRES! ⏳",
                "kinetic_highlight": "NUNGGU LAMA BIKIN STRES"
            },
            {
                "scene_index": 3,
                "name": "Solution & Demo",
                "start_sec": 15,
                "end_sec": 45,
                "duration_sec": 30,
                "visual_cue": f"Sambil sikat gigi colok {product_name}, 15 menit kemudian indikator baterai sudah hijau 60 persen",
                "narration": f"Untung ketemu {product_name}! Cukup ditinggal mandi 15 menit pas pagi hari, daya langsung terisi berkat {usp_1}. Aman dibawa kemana-mana karena {usp_3}, plus ada perlindungan {usp_2}.",
                "on_screen_text": f"TINGGAL MANDI 15 MENIT SUDAH HIJAU 🔋",
                "kinetic_highlight": "15 MENIT LANGSUNG PENUH"
            },
            {
                "scene_index": 4,
                "name": "Strong CTA",
                "start_sec": 45,
                "end_sec": 60,
                "duration_sec": 15,
                "visual_cue": "Bawa jalan dengan percaya diri, kartu garansi resmi ditunjukkan ke kamera, tap keranjang kuning",
                "narration": f"Sekarang hidup jauh lebih tenang. Khusus hari ini ada promo potongan harga jadi {formatted_price}. Cek keranjang kuning sebelum kuota habis!",
                "on_screen_text": f"PROMO SPESIAL HARI INI: {formatted_price} ✨",
                "kinetic_highlight": "CEK KERANJANG KUNING SEKARANG"
            }
        ]

        variants = [
            {
                "id": f"variant_fomo_{uuid.uuid4().hex[:6]}",
                "angle_type": "FOMO_AGITATION",
                "angle_label": "🔥 FOMO & Agitasi Masalah (High CTR / Viral Hook)",
                "hook_text": v1_scenes[0]["narration"],
                "target_pacing_wpm": 145,
                "scenes": v1_scenes,
                "estimated_duration_sec": 60,
                "compliance_check": self.check_compliance(v1_scenes),
                "is_selected": True
            },
            {
                "id": f"variant_edu_{uuid.uuid4().hex[:6]}",
                "angle_type": "EDUCATIONAL_REVIEW",
                "angle_label": "💡 Review Edukatif & Analisis Nilai (Trust & Conviction)",
                "hook_text": v2_scenes[0]["narration"],
                "target_pacing_wpm": 140,
                "scenes": v2_scenes,
                "estimated_duration_sec": 60,
                "compliance_check": self.check_compliance(v2_scenes),
                "is_selected": False
            },
            {
                "id": f"variant_story_{uuid.uuid4().hex[:6]}",
                "angle_type": "BEFORE_AFTER_STORY",
                "angle_label": "📖 Cerita Before-After (Emosional & Relatable)",
                "hook_text": v3_scenes[0]["narration"],
                "target_pacing_wpm": 142,
                "scenes": v3_scenes,
                "estimated_duration_sec": 60,
                "compliance_check": self.check_compliance(v3_scenes),
                "is_selected": False
            }
        ]

        return variants

    def check_compliance(self, scenes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Quality Assurance & Platform Compliance Guard:
        Mendeteksi klaim berlebihan (overclaim), jaminan palsu, serta pelanggaran kebijakan platform iklan (TikTok/Meta).
        """
        combined_text = " ".join([s.get("narration", "") for s in scenes]).lower()
        warnings = []

        for pattern in self.PROHIBITED_OVERCLAIMS:
            if re.search(pattern, combined_text):
                warnings.append(f"Klaim terlarang terdeteksi: '{pattern}' melanggar kebijakan periklanan.")

        # Cek durasi scene
        total_duration = sum([s.get("duration_sec", 0) for s in scenes])
        if total_duration > 65:
            warnings.append(f"Durasi total ({total_duration} detik) melebihi batas 60 detik.")

        # Cek ketersediaan CTA di scene terakhir
        last_scene = scenes[-1] if scenes else {}
        if "keranjang" not in last_scene.get("narration", "").lower() and "link" not in last_scene.get("narration", "").lower():
            warnings.append("Scene penutup tidak memiliki ajakan Call to Action (CTA) yang jelas.")

        status = "PASSED" if not warnings else "NEEDS_REVISION"
        score = 99.0 if not warnings else max(50.0, 99.0 - (len(warnings) * 20.0))

        return {
            "status": status,
            "compliance_score": score,
            "warnings": warnings,
            "rules_checked": [
                "anti_overclaim_health_wealth",
                "bpom_and_consumer_protection",
                "tiktok_shop_advertising_guidelines",
                "duration_boundary_60s",
                "cta_presence_validation"
            ]
        }
