ХАРАКТЕРНИК — ОКРЕМІ СТОРІНКИ / оновлення 18.11.2026

Що нового:
1. Кнопка «Приєднатися» веде прямо на register.html.
2. Кожний розділ сайту має власну HTML-сторінку.
3. Особистий кабінет у profile.html, вхід у login.html.
4. При збереженні профілю — повідомлення «Зміни збережено» тільки після успішної відповіді Supabase; при помилці — червоне повідомлення.
5. Панорама, емблема, шеврон ГАРТ №001 і криптодонати збережені.

Завантаження у GitHub:
1. Зробіть резервну копію поточного index.html.
2. Розпакуйте ZIP. У репозиторії Characternik/characternik → Code → Add file → Upload files.
3. Додайте ВСІ HTML-файли, style.css, app.js, config.js та ПАПКУ assets з її вмістом.
4. Commit changes. Всі файли мають бути в корені репозиторію, папка assets — на одному рівні з index.html.
5. Перевірте: /characternik/register.html, /login.html, /profile.html, /members.html.
6. Supabase → Authentication → URL Configuration → Redirect URLs: додайте
   https://characternik.github.io/characternik/login.html
   https://characternik.github.io/characternik/password.html
   Основний Site URL залиште як є.

Паролі, service_role та sb_secret_ ключі не завантажуйте на GitHub! У config.js лише публічний ключ.
Реальну реєстрацію й збереження потрібно перевірити на опублікованому сайті після завантаження.
Обробка повернення зі старих листів реєстрації на index.html: головна містить посилання на вхід.

Сторінка password.html залишена у вже перевіреній версії відновлення пароля, без нового механізму.
