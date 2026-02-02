import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const API_URL = "https://api-football-v1.p.rapidapi.com/v3";
const headers = {
  "X-RapidAPI-Key": process.env.FOOTBALL_API_KEY,
  "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com"
};

/* ================= PHÂN TÍCH PHONG ĐỘ ================= */
function phanTichPhongDo(dsTran, teamId) {
  let thang = 0, hoa = 0, thua = 0;
  let ghi = 0, thu = 0;

  dsTran.forEach(t => {
    const laNha = t.teams.home.id === teamId;
    const banThang = laNha ? t.goals.home : t.goals.away;
    const banThua = laNha ? t.goals.away : t.goals.home;

    ghi += banThang;
    thu += banThua;

    if (banThang > banThua) thang++;
    else if (banThang === banThua) hoa++;
    else thua++;
  });

  return {
    thang,
    hoa,
    thua,
    hieu_so: ghi - thu,
    diem_suc_manh: thang * 3 + hoa
  };
}

/* ================= DỰ ĐOÁN KÈO ================= */
function duDoanKeo(home, away) {
  const diff = home.diem_suc_manh - away.diem_suc_manh;
  if (diff >= 6) return "-1";
  if (diff >= 4) return "-0.75";
  if (diff >= 2) return "-0.5";
  if (diff >= 1) return "-0.25";
  if (diff === 0) return "0";
  if (diff <= -1) return "+0.25";
  return "+0.5";
}

function duDoanHoa(home, away) {
  const diff = Math.abs(home.diem_suc_manh - away.diem_suc_manh);
  if (diff <= 1) return "CAO";
  if (diff <= 3) return "TRUNG BÌNH";
  return "THẤP";
}

/* ================= API ALL TRẬN HÔM NAY ================= */
app.get("/bong-da/hom-nay", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const fixturesRes = await axios.get(`${API_URL}/fixtures`, {
      params: { date: today },
      headers
    });

    const fixtures = fixturesRes.data.response;
    const ketQua = [];

    for (const tran of fixtures) {
      const homeId = tran.teams.home.id;
      const awayId = tran.teams.away.id;

      const homeLast = await axios.get(`${API_URL}/fixtures`, {
        params: { team: homeId, last: 5 },
        headers
      });

      const awayLast = await axios.get(`${API_URL}/fixtures`, {
        params: { team: awayId, last: 5 },
        headers
      });

      const phongDoNha = phanTichPhongDo(homeLast.data.response, homeId);
      const phongDoKhach = phanTichPhongDo(awayLast.data.response, awayId);

      ketQua.push({
        id_tran: tran.fixture.id,
        giai_dau: tran.league.name,
        gio_dau: tran.fixture.date.slice(11, 16),
        tran_dau: `${tran.teams.home.name} vs ${tran.teams.away.name}`,

        phan_tich: {
          doi_nha: phongDoNha,
          doi_khach: phongDoKhach
        },

        du_doan: {
          keo_chap: `${tran.teams.home.name} ${duDoanKeo(phongDoNha, phongDoKhach)}`,
          kha_nang_hoa: duDoanHoa(phongDoNha, phongDoKhach)
        },

        nhan_dinh:
          duDoanHoa(phongDoNha, phongDoKhach) === "CAO"
            ? "Hai đội cân kèo, khả năng hòa cao"
            : "Có sự chênh lệch phong độ"
      });
    }

    res.json({
      ngay: today,
      tong_so_tran: ketQua.length,
      danh_sach_tran: ketQua
    });

  } catch (err) {
    res.status(500).json({ loi: err.message });
  }
});

app.listen(PORT, () => {
  console.log("⚽ Football API đang chạy");
});
