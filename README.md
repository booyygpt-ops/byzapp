# Byz Workspace

GitHub, GitLab veya diğer HTTPS Git sunucularındaki herkese açık depoları içe alıp inceleyebileceğin, dosyalarını düzenleyip Docker içinde çalıştırabileceğin kişisel Windows masaüstü uygulaması.

## Windows paketini indir

- [Windows kurulum dosyası (.exe)](https://github.com/booyygpt-ops/byzapp/releases/download/v0.1.0/Byz-Workspace-Setup-0.1.0-x64.exe)
- [Çıkarıp çalıştırmak için ZIP](https://github.com/booyygpt-ops/byzapp/releases/download/v0.1.0/Byz-Workspace-0.1.0-Windows-x64.zip)
- [Sürüm notları ve sağlama toplamları](https://github.com/booyygpt-ops/byzapp/releases/tag/v0.1.0)

Windows x64, Git for Windows ve çalışan Docker Desktop (WSL 2 / Linux containers) gerekir. Paketler imzasızdır; Windows üzerinde derlenmiştir, etkileşimli Windows testi henüz yapılmamıştır.

## Windows'ta kullanım

Gereksinimler: Windows 10/11 x64, WSL 2 kullanan **Docker Desktop (Linux containers)** ve **Git for Windows**. Docker açık olmalı. Kaynaktan başlatmak veya kurulum dosyası üretmek için ayrıca Node.js 22+ gerekir. Uygulama içine alınan projeler için bilgisayara ayrıca Node/Python kurmak gerekmez.

```powershell
npm ci
npm run build
npm run desktop
```

1. **Ortam ayarları** ekranında Git ve Docker durumunu kontrol et; **Çalışma ortamını hazırla** düğmesine bas. İlk hazırlık Docker imajını indirir ve Node.js 22/Python 3 araçlarını kurar.
2. **Depo içe aktar** ile herkese açık bir HTTPS Git adresi ekle. İçe aktarma kodu çalıştırmaz; önce kaynak kodu ve lisansı incele.
3. **Çalıştırma ayarları** ekranında algılanan komutları kontrol et. Gerekirse **Bağımlılıkları kur**, sonra **Çalıştır**.
4. **Önizleme** ve **Günlükler** sekmelerinden sonucu izle. Dosya değiştirmek için önce projeyi durdur; düzenle, kaydet ve tekrar çalıştır.

Depo olmadan denemek için boş ana ekrandaki **Örnek projeyi aç** düğmesini kullan. Bu Node.js örneği harici paket gerektirmez.

### Hazır ZIP sürümü

Üretilen `Byz Workspace-0.1.0-win.zip` dosyasını Windows'ta **tamamen çıkar**, ardından `Byz Workspace.exe` dosyasını aç. EXE'yi diğer dosyalardan ayırma. Bu sürümde Git for Windows ve açık Docker Desktop gerekir; Node.js yalnızca geliştirme için gereklidir. Windows'ta gerçek kurulum/çalıştırma doğrulaması henüz yapılmamıştır.

ZIP paketini yeniden üretmek için `npm run dist:win:zip` kullan. Linux'ta ZIP üretimi Wine gerektirmez. NSIS kurulum sihirbazını Linux'ta üretmek Wine gerektirir; bu ortamda kurulum sihirbazı doğrulanmamıştır.

### Windows kurulum dosyası

```powershell
npm ci
npm run dist:win
```

NSIS kurulum dosyası `release/` klasörüne çıkar. GitHub Actions'taki **Windows installer** iş akışı elle başlatıldığında EXE ve ZIP çıktılarını artifact olarak saklar. `v*` etiketi gönderildiğinde Windows üzerinde iki paketi derler ve sağlama toplamlarıyla GitHub Releases'e yayımlar. Yayınlama izni yalnızca ayrı release işine verilir. Kurulum dosyası imzasızdır; dağıtım öncesi kod imzalama ayrıca yapılandırılmalıdır.

## Destek kapsamı

- **Node.js/npm:** `package.json` algılanır. `package-lock.json` varsa `npm ci`, yoksa `npm install --no-package-lock` önerilir. `dev`/`start` komutları seçilir; Vite ve Next.js için adres/port argümanları eklenir. pnpm/yarn/monorepo projeleri otomatik kurulmaz.
- **Python:** `requirements.txt`, `pyproject.toml`, `app.py` veya `main.py` algılanır; proje içindeki `.venv` kullanılır. requirements.txt içinde FastAPI/uvicorn varsa uvicorn, diğerlerinde Flask başlangıcı önerilir. Modül adını ve bağımlılıkları projeye göre kontrol et.
- **Statik dosyalar:** Python HTTP sunucusuyla önizlenir.
- Komutlar değiştirilebilir. Önizleme için sunucu **0.0.0.0** adresini ve ayarlanan portu dinlemeli; uygulama `PORT` ve `HOST` değişkenlerini verir. Web sunucusu olmayan programların çıktısı yalnızca günlüklerde görünür.
- Özel depolar, SSH anahtarları, Docker Compose, çok servisli veritabanı ortamları, Java/Go/.NET, GPU, Android/iOS ve Windows GUI projeleri bu ilk sürümde otomatik desteklenmez. Alt modüller ve Git LFS içeriği otomatik indirilmez. Varsayılan dal içe alınır, dal seçimi/senkronizasyon/Git push yoktur.

## Çalışma modeli ve veri

Electron arayüzü React/Vite ile oluşturulur. Yerel Node.js API sunucusu yalnızca `127.0.0.1` üzerinde rastgele bir port dinler. API her açılışta yeni üretilen oturum anahtarını ister. Electron renderer'da Node.js kapalıdır, sandbox ve context isolation açıktır. Önizleme farklı bir yerel origin üzerinde, sandbox'lı iframe'de gösterilir; API kimlik bilgileri önizlemeye gönderilmez.

Her kurulum/çalıştırma işlemi ayrı, root olmayan bir Docker konteynerinde çalışır: salt okunur kök dosya sistemi, düşürülmüş Linux yetkileri, 1 CPU / 1 GB bellek / 256 PID sınırı. Yalnızca ilgili proje klasörü yazılabilir bağlanır; Docker soketi, kişisel klasörler ve ana makine ortam değişkenleri projeye aktarılmaz. Konteynerin ağ erişimi vardır; kurulum betikleri dahil içeri alınan kod **güvenilir olmalı**. Docker tam bir kötü amaçlı kod güvenlik sınırı değildir; bu uygulama çok kullanıcılı veya düşmanca kod çalıştırma hizmeti için tasarlanmadı.

Masaüstü verileri Electron `userData/workspace` klasöründe kalır (Windows'ta genellikle `%APPDATA%/Byz Workspace/workspace`). Depolar `projects/<id>/repo`, proje ayarları `project.json` içindedir. Uygulamayı kapatmak projeleri durdurur; yeniden açıldığında kendiliğinden kod çalıştırılmaz. Yarım kalan oturuma ait konteynerler bir sonraki başlangıçta temizlenir. Dosyaları silmeden önce yerel değişikliklerini yedekle.

## Geliştirme ve doğrulama

```sh
npm ci
npm run runtime:build
npm run build
npm test
npm run dev
```

`npm test`, gerçek Docker imajını gerektirir; Node.js ve Python HTTP sunucularını başlatır, içeriği doğrular, durdurur ve veri kalıcılığı/dosya sınırlarını kontrol eder. İnternet gerektiren arayüz testi ayrıca gerçek bir GitHub deposunu içe alır:

```sh
npx playwright install chromium
npm run test:e2e
```

Mevcut bir Chromium kullanmak için `BYZ_TEST_BROWSER` ortam değişkenine tam yürütülebilir dosya yolunu ver. E2E testi `.data/e2e` içinde çalışır; temiz bir ilk ekran için bu test klasörünü önce kaldır. Bulutta GUI yoksa `npm run build`, API/Docker testleri ve headless Chromium arayüz testi kullanılabilir. Bu kontroller Windows'ta gerçek kurulum testi yerine geçmez.
