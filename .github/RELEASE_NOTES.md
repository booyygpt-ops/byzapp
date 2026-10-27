## Byz Workspace — Windows ilk sürüm

GitHub/GitLab ve diğer HTTPS Git adreslerinden herkese açık projeleri al, dosyalarını düzenle ve Docker içinde çalıştır.

### İndir ve aç

- **ZIP:** Dosyanın tamamını çıkar, içindeki `Byz Workspace.exe` dosyasını aç. EXE'yi diğer dosyalardan ayırma.
- **Setup EXE:** Kurulum sihirbazıyla yükle.
- Gereksinimler: Windows x64, **Git for Windows**, **Docker Desktop** (WSL 2 / Linux containers). Docker açık olmalı.
- Uygulamada **Ortam ayarları → Çalışma ortamını hazırla**, sonra **Depo içe aktar**.

Node.js/npm, Python ve statik projeler için başlangıç komutları algılanır. Her repo otomatik çalışmaz; proje komutlarını incele. Özel depolar, mobil/masaüstü GUI projeleri ve çok servisli ortamlar bu ilk sürümde otomatik desteklenmez.

Paketler imzasızdır. Windows runner üzerinde derlenmiştir; Windows'ta etkileşimli uygulama testi henüz yapılmamıştır. Linux'ta dört otomatik test ve gerçek GitHub içe aktarma + Docker önizlemesi içeren bir Chromium arayüz testi geçmiştir. Güvendiğin kodları kullan; Docker kötü amaçlı kod için tam bir güvenlik sınırı değildir.

`SHA256SUMS.txt`, indirilen dosyaların bütünlüğünü kontrol etmek içindir.
