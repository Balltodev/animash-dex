# Animash Fusion Dex

ค้นหาว่าสัตว์ตัวไหนผสมกันแล้วได้อะไรในเกม Animash — รูป, ดาว, ทอง/เพชร/รุ้ง, status, ability และสูตรผสม
พร้อม filter ตามชุดสัตว์ (Animal Set), ดาว, rarity และชื่อ

ข้อมูลจาก [The Unofficial Animash Wiki](https://the-unofficial-animash.fandom.com/wiki/The_Unofficial_Animash_Wiki) (CC BY-SA)

- `site/` — ตัวเว็บ (static) ที่ deploy ขึ้น GitHub Pages
- `scripts/update_data.sh` — ดึงข้อมูลจาก wiki ใหม่และสร้าง `site/data.js`

ดูในเครื่อง: `python3 -m http.server 8765 --directory site`
