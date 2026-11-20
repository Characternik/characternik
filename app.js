/* ХАРАКТЕРНИК / v2 · сторінки та безпечний клієнт Supabase.
   Всі значення Supabase у config.js є публічними; жодного секретного ключа тут немає. */
(() => {
  'use strict';
  const cfg = window.KHAR_CONFIG || {};
  const $ = id => document.getElementById(id);
  const page = document.body.dataset.page || '';
  const baseURL = new URL('./', location.href.startsWith('about:') ? 'https://characternik.github.io/characternik/' : location.href);
  const link = filename => new URL(filename,baseURL).href;
  const formatNo = number => String(number).padStart(3,'0');
  const addressLabel = db => ({pobratym:'Побратим',posestra:'Посестра',participant:'Учасник'})[db] || 'Учасник';
  const addressDb = label => ({'Побратим':'pobratym','Посестра':'posestra','Учасник':'participant'})[label] || 'participant';
  const setMessage = text => {const node=$('khAuthMessage');if(node)node.textContent=text;};
  const safeText = value => String(value ?? '');
  const notify = (title, detail='', isError=false) => {
    const stack=$('khToasts');
    if(!stack)return;
    const toast=document.createElement('div');toast.className='kh-toast'+(isError?' error':'');toast.setAttribute('role',isError?'alert':'status');
    const mark=document.createElement('span');mark.textContent=isError?'⚠':'✓';mark.setAttribute('aria-hidden','true');
    const words=document.createElement('div');const strong=document.createElement('strong');strong.textContent=title;
    words.append(strong);
    if(detail){const p=document.createElement('small');p.textContent=detail;words.append(p);}
    const close=document.createElement('button');close.type='button';close.setAttribute('aria-label','Закрити повідомлення');close.textContent='×';close.addEventListener('click',()=>toast.remove());
    toast.append(mark,words,close);stack.append(toast);
    setTimeout(()=>toast.remove(),6500);
  };
  const sanitizeError = err => {
    const msg=String(err?.message || 'Спробуй ще раз');
    if(/duplicate key|already exists/i.test(msg))return 'Цей позивний вже зайнятий. Обери інший.';
    if(/Invalid login credentials/i.test(msg))return 'Невірна пошта або пароль. Перевір їх чи віднови пароль.';
    if(/Email not confirmed/i.test(msg))return 'Підтверди електронну адресу через лист.';
    if(/Failed to fetch|NetworkError/i.test(msg))return 'Немає зв’язку з базою даних. Перевір інтернет і спробуй знову.';
    return msg.slice(0,200);
  };
  const displayError = (err, context='Дія не виконана') => {
    const msg=sanitizeError(err);setMessage(context+': '+msg);notify(context,msg,true);
  };
  const withButton = async (form, action) => {
    const button=form?.querySelector('button[type="submit"]');
    if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
    try{await action();}catch(err){displayError(err);}finally{if(button){button.disabled=false;button.removeAttribute('aria-busy');}}
  };
  $('year') && ($('year').textContent=new Date().getFullYear());
  const menu=$('menuButton'),nav=$('navLinks');
  if(menu&&nav){menu.addEventListener('click',()=>{const opened=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(opened));});}
  const observe=[...document.querySelectorAll('.reveal')];
  if('IntersectionObserver' in window){const observer=new IntersectionObserver((entries)=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target);}}),{threshold:.08});observe.forEach(el=>observer.observe(el));}
  else observe.forEach(el=>el.classList.add('visible'));

  // Use public key only. Real access control is in Supabase RLS.
  let client=null;
  try{
    if(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.supabaseUrl||'')
       && /^sb_publishable_[A-Za-z0-9_-]+$/.test(cfg.publishableKey||'')
       && window.supabase?.createClient){
      client=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    }
  }catch(e){console.warn('Supabase initialization failed',e);}
  const getUser = async () => {
    if(!client)throw new Error('Сервіс реєстрації ще недоступний. Перевір config.js або підключення інтернету.');
    const {data,error}=await client.auth.getUser();if(error)throw error;
    return data.user;
  };
  const getMyProfile=async user => {
    const {data,error}=await client.from('khar_profiles')
      .select('id,member_no,callsign,display_as,rank,role,listed,bio')
      .eq('id',user.id).maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Профіль не знайдено в базі. Перевір реєстрацію або SQL-налаштування.');
    return data;
  };
  // Спільна навігація для ВСІХ сторінок: гість — «Увійти», учасник — «Кабінет».
  // Supabase зберігає сесію між HTML-сторінками одного сайту; переходи не викликають signOut.
  function initAccountNavigation(){
    const join=document.querySelector('#navLinks .nav-join');
    if(!join)return;
    const loginLink=document.createElement('a');
    loginLink.href=link('login.html');
    loginLink.className='kh-nav-login';
    loginLink.textContent='Увійти';
    const awardsLink=document.createElement('a');
    awardsLink.href=link('awards.html');
    awardsLink.className='kh-nav-awards';
    awardsLink.textContent='✦ Керування відзнаками';
    awardsLink.hidden=true;
    join.before(awardsLink,loginLink);

    // На головній поруч із «Приєднатися» — компактний доступ до входу.
    const heroActions=page==='index'?document.querySelector('.landscape-actions'):null;
    const heroJoin=heroActions?.querySelector('a[href="register.html"]');
    let heroLogin=null;
    if(heroJoin){
      heroLogin=document.createElement('a');
      heroLogin.href=link('login.html');
      heroLogin.className='kh-hero-login';
      heroLogin.textContent='Увійти →';
      heroJoin.after(heroLogin);
    }
    const bottomJoin=page==='index'?document.querySelector('.page-action a[href="register.html"]'):null;
    const bottomLogin=page==='index'?document.querySelector('.page-action a[href="login.html"]'):null;
    let renderId=0;
    async function render(){
      const token=++renderId;
      let user=null;
      if(client){
        try{
          const {data,error}=await client.auth.getSession();
          if(error)throw error;
          user=data?.session?.user||null;
        }catch(e){console.warn('Не вдалося прочитати сесію',e);}
      }
      if(token!==renderId)return;
      const signedIn=Boolean(user);
      join.href=link(signedIn?'profile.html':'register.html');
      join.textContent=signedIn?'Кабінет':'Приєднатися';
      join.setAttribute('aria-label',signedIn?'Відкрити особистий кабінет':'Приєднатися до братства');
      if(signedIn)join.setAttribute('aria-current',page==='profile'?'page':'false');
      else join.removeAttribute('aria-current');
      loginLink.hidden=signedIn;
      awardsLink.hidden=true;
      if(heroJoin){
        heroJoin.href=link(signedIn?'profile.html':'register.html');
        // Не перезаписуємо вміст через innerHTML: залишаємо лише безпечний текст.
        heroJoin.textContent=signedIn?'Мій кабінет ↗':'Приєднатися до братства ↗';
        heroLogin.hidden=signedIn;
      }
      if(bottomJoin){
        bottomJoin.href=link(signedIn?'profile.html':'register.html');
        bottomJoin.textContent=signedIn?'Перейти до кабінету ↗':'Приєднатися до братства ↗';
      }
      if(bottomLogin)bottomLogin.hidden=signedIn;
      if(!signedIn)return;
      try{
        const p=await getMyProfile(user);
        if(token!==renderId)return;
        const founder= p.role==='founder' && Number(p.member_no)===1;
        awardsLink.hidden=!founder;
        const profileAwards=$('khFounderTools');
        if(profileAwards)profileAwards.hidden=!founder;
        // Посилання в публічній картці засновника працює незалежно від обговорень.
        const founderLink=$('khAwardsAdminLink');
        if(founderLink)founderLink.hidden=!founder;
      }catch(e){
        // Навіть якщо БД тимчасово недоступна, кнопка «Кабінет» залишається.
        console.warn('Не вдалося перевірити роль для навігації',e);
      }
    }
    render().catch(e=>console.warn('Помилка навігації',e));
    if(client){
      // Не виконуємо асинхронні виклики Supabase всередині callback зміни auth.
      client.auth.onAuthStateChange(()=>setTimeout(()=>render().catch(e=>console.warn(e)),0));
    }
  }
  initAccountNavigation();

  async function publicProfiles(){
    if(!client)throw new Error('Не вдалося підключитися до списку учасників.');
    const {data,error}=await client.from('khar_profiles')
      .select('member_no,callsign,display_as,rank,role,bio')
      .eq('listed',true).order('member_no',{ascending:true}).limit(250);
    if(error)throw error;
    return data || [];
  }


  // Shared insignia visual system: same backing for founder, first posestra, and all other ranks.
  // The personal №002 insignia is honorary; database rank remains 'Шукач'.
  const isAnastesha = p => Number(p?.member_no) === 2 && String(p?.callsign || '').trim().toLocaleLowerCase('uk-UA') === 'anastesha';
  const rankDesign = rank => {
    const v=String(rank||'Шукач').trim().toLocaleLowerCase('uk-UA');
    if(v==='учень')return {key:'apprentice',name:'УЧЕНЬ',sign:'✧'};
    if(v==='побратим')return {key:'brother',name:'ПОБРАТИМ',sign:'✦'};
    if(v==='вартовий')return {key:'guardian',name:'ВАРТОВИЙ',sign:'✥'};
    if(v==='характерник')return {key:'character',name:'ХАРАКТЕРНИК',sign:'⚝'};
    return {key:'seek',name:'ШУКАЧ',sign:'◇'};
  };
  function chevronFor(p,container,mini=false){
    if(!container)return;
    const founder=p.role==='founder' && Number(p.member_no)===1;
    const firstSister=isAnastesha(p);
    const design=founder?'founder':firstSister?'anastesha':rankDesign(p.rank).key;
    container.className='kh-chevron-stage'+(mini?' kh-chevron-mini':'')+(container.id==='khProfileChevron'?' kh-account-chevron':'');
    container.dataset.design=design;
    container.replaceChildren();
    if(founder||firstSister){
      const img=document.createElement('img');img.className='kh-chevron-image';
      img.src=link(founder?'assets/gart-shield.webp':'assets/anastesha-shield.webp');
      img.alt=founder?'Золотий шеврон ГАРТ №001':'Особистий шеврон ANASTESHA №002';
      img.loading=mini?'lazy':'eager';container.append(img);
    }else{
      const item=rankDesign(p.rank),badge=document.createElement('div');badge.className='kh-chevron-fallback';
      const symbol=document.createElement('span');symbol.className='kh-fallback-mark';symbol.textContent=item.sign;
      const label=document.createElement('strong');label.textContent=item.name;
      const note=document.createElement('small');note.textContent='ЗНАК РАНГУ';
      badge.append(symbol,label,note);container.append(badge);
    }
    container.setAttribute('role','img');
    container.setAttribute('aria-label',founder?'Шеврон засновника ГАРТ №001':firstSister?'Шеврон першої посестри ANASTESHA №002':'Знак рангу '+(p.rank||'Шукач'));
  }
  const chevronCaption=p=>Number(p.member_no)===1&&p.role==='founder'?'Особистий шеврон засновника · №001':isAnastesha(p)?'Особистий шеврон першої посестри · №002':'Єдиний шаблон шеврона рангу «'+(p.rank||'Шукач')+'»';

  const readOptional = id => ($(id)?.value||'').trim();
  const cleanContact = (name,id,max=60) => {
    const v=readOptional(id);
    if(v.length>max)throw new Error(name+': надто довге значення.');
    return v || null;
  };
  const birthYear = id => {
    const raw=readOptional(id);if(!raw)return null;
    const yr=Number(raw),latest=new Date().getFullYear();
    if(!Number.isInteger(yr)||yr<1900||yr>latest)throw new Error('Перевір рік народження.');
    return yr;
  };
  const contactPhone = id => {
    const value=readOptional(id);if(!value)return null;
    if(!/^\+?[0-9() .-]{7,22}$/.test(value))throw new Error('Перевір номер телефону: використай цифри, за потреби знак +.');
    return value;
  };
  // «Поклик братства»: код передається один раз під час створення акаунта.
  // Його перевіряє та записує серверний тригер SQL 07; браузер нічого не пише в khar_referrals.
  function parseInvitationCode(raw){
    const value=String(raw||'').trim().toUpperCase();
    if(!/^KH[0-9]{6,18}$/.test(value))return null;
    try{
      const member=BigInt(value.slice(2));
      if(member<1n || member>9223372036854775807n)return null;
      return value===('KH'+member.toString().padStart(6,'0'))?value:null;
    }catch(e){return null;}
  }
  if(page==='register'){
    const form=$('khRegisterForm');
    const invitationParameter=new URLSearchParams(location.search).get('ref');
    const invitationCode=parseInvitationCode(invitationParameter);
    const inviteBanner=$('khInvitationBanner');
    if(inviteBanner){
      if(invitationParameter){
        inviteBanner.hidden=false;
        inviteBanner.textContent=invitationCode
          ?'✦ Тебе запросили до братства. Код запрошення: '+invitationCode+'. Він буде врахований після підтвердження пошти та вступного випробування.'
          :'⚠ Некоректний код запрошення. Реєстрація можлива, але запрошення не буде зараховано. Перевір посилання.';
        inviteBanner.classList.toggle('kh-ref-invite-warning',!invitationCode);
      }
    }
    form?.addEventListener('submit',event=>{
      event.preventDefault();
      withButton(form,async()=>{
        const callsign=$('khNewCallsign').value.trim();
        if(callsign.toLocaleLowerCase('uk-UA')==='гарт')throw new Error('Позивний ГАРТ зарезервований за засновником №001.');
        const selected=form.querySelector('input[name="khRegAddress"]:checked');
        const chosen=addressDb(selected?.value || 'Учасник');
        const email=$('khRegEmail').value.trim();
        const {data,error}=await client.auth.signUp({
          email, password:$('khRegPassword').value,
          options:{emailRedirectTo:link('login.html'), data:{callsign, display_as:chosen,
            khar_given_name:cleanContact('Ім’я','khRegFirstName'),
            khar_family_name:cleanContact('Прізвище','khRegLastName'),
            khar_birth_year:birthYear('khRegBirthYear'),
            khar_phone:contactPhone('khRegPhone'),
            ...(invitationCode?{khar_ref:invitationCode}:{})}}
        });
        if(error)throw error;
        // No fake success if Supabase did not provide a user.
        if(!data?.user)throw new Error('Підтвердження реєстрації не отримано.');
        form.reset();
        if(data.session){setMessage('Профіль створено. Перенаправляємо до кабінету.');notify('Реєстрацію завершено','Відкриваємо твій кабінет.');setTimeout(()=>location.assign(link('profile.html')),850);}
        else{
          try{sessionStorage.setItem('khar_pending_confirm_email',email);}catch(e){}
          setMessage('Перевір пошту: введи код підтвердження на наступній сторінці.');
          notify('Перевір пошту','Відкриваємо сторінку введення коду.');
          setTimeout(()=>location.assign(link('verify.html')),900);
        }
      });
    });
  }
  // Підтвердження адреси кодом із листа, без переходу за посиланнями в email.
  if(page==='verify'){
    const form=$('khEmailCodeForm');
    const resend=$('khResendEmailCode');
    const emailInput=$('khConfirmEmail');
    const tokenInput=$('khConfirmCode');
    if(emailInput){
      try{emailInput.value=sessionStorage.getItem('khar_pending_confirm_email')||'';}catch(e){}
    }
    form?.addEventListener('submit',event=>{
      event.preventDefault();
      withButton(form,async()=>{
        if(!client)throw new Error('Немає підключення до Supabase.');
        const email=(emailInput?.value||'').trim();
        const token=(tokenInput?.value||'').replace(/\s/g,'');
        if(!email||!/^[0-9]{6}$/.test(token))throw new Error('Введи адресу пошти та 6-значний код із листа.');
        // Signup-confirmation OTP uses type 'email' in supabase-js v2.
        const {data,error}=await client.auth.verifyOtp({email,token,type:'email'});
        if(error)throw error;
        if(!data?.user)throw new Error('Supabase не підтвердив користувача. Спробуй ще раз.');
        try{sessionStorage.removeItem('khar_pending_confirm_email');}catch(e){}
        if(tokenInput)tokenInput.value='';
        setMessage('Електронну пошту підтверджено. Перенаправляємо до кабінету.');
        notify('Пошту підтверджено','Ласкаво просимо до братства!');
        setTimeout(()=>location.assign(link(data.session?'profile.html':'login.html')),850);
      });
    });
    resend?.addEventListener('click',async()=>{
      if(!client){displayError(new Error('Немає підключення до Supabase.'));return;}
      const email=(emailInput?.value||'').trim();
      if(!email||!emailInput.checkValidity()){
        displayError(new Error('Спочатку введи правильну електронну адресу.'));return;
      }
      resend.disabled=true;resend.setAttribute('aria-busy','true');
      try{
        const {error}=await client.auth.resend({type:'signup',email});
        if(error)throw error;
        try{sessionStorage.setItem('khar_pending_confirm_email',email);}catch(e){}
        if(tokenInput)tokenInput.value='';
        setMessage('Код повторно надіслано, якщо адреса очікує підтвердження. Перевір також Спам.');
        notify('Перевір пошту','Новий код може надійти із затримкою.');
      }catch(error){displayError(error,'Не вдалося повторно надіслати код');}
      finally{resend.disabled=false;resend.removeAttribute('aria-busy');}
    });
  }
  if(page==='login'){
    const form=$('khLoginForm');
    form?.addEventListener('submit',event=>{
      event.preventDefault();
      withButton(form,async()=>{
        const {data,error}=await client.auth.signInWithPassword({email:$('khLoginEmail').value.trim(),password:$('khLoginPassword').value});
        if(error)throw error;
        if(!data?.user)throw new Error('Не вдалося підтвердити вхід.');
        $('khLoginPassword').value='';
        setMessage('Успішний вхід. Відкриваємо кабінет…');notify('Вхід виконано','Ласкаво просимо до братства.');
        setTimeout(()=>location.assign(link('profile.html')),750);
      });
    });
    const params=new URLSearchParams(location.search);
    if(params.get('confirmed')==='1'){notify('Пошту підтверджено','Тепер можеш увійти.');}
  }
  if(page==='profile'){
    const view=$('khAccountView'),loading=$('profileLoading'),form=$('khProfileForm');
    let currentUser=null,currentProfile=null;
    const present=p=>{
      currentProfile=p;
      chevronFor(p,$('khProfileChevron'));
      $('khProfileChevronCaption').textContent=chevronCaption(p);
      if($('khRegSideNum'))$('khRegSideNum').textContent='№'+formatNo(p.member_no);
      const myCard=$('khMyPublicCard'),myLink=$('khMyPublicCardLink');
      if(myCard&&myLink){myCard.hidden=!p.listed||!p.callsign;myLink.href=(p.role==='founder'&&Number(p.member_no)===1)?link('founder.html'):link('member.html?no='+encodeURIComponent(p.member_no));}
      $('khAccountTitle').textContent=p.callsign || 'Обери позивний';
      $('khAccountNumber').textContent='№'+formatNo(p.member_no);
      $('khAccountRank').textContent=(p.role==='founder'?'Засновник':'Ранг: '+p.rank)+' · '+addressLabel(p.display_as);
      if($('khFounderTools'))$('khFounderTools').hidden=!(p.role==='founder' && Number(p.member_no)===1);
      $('khEditCallsign').value=p.callsign || '';
      $('khEditAddress').value=addressLabel(p.display_as);
      $('khEditBio').value=p.bio || '';
      if($('khBioRemaining'))$('khBioRemaining').textContent=String((p.bio||'').length)+' / 1000 символів';
      $('khEditPublic').checked=Boolean(p.listed);
      $('khEditCallsign').readOnly=p.role==='founder';
      $('khEditCallsign').title=p.role==='founder'?'Позивний ГАРТ закріплений за засновником.':'';
      view.hidden=false;loading.hidden=true;
    };
    (async()=>{
      try{
        currentUser=await getUser();
        if(!currentUser){location.replace(link('login.html'));return;}
        present(await getMyProfile(currentUser));
        loadProfilePath().catch(e=>console.warn('Path unavailable',e));
        loadMyReferrals().catch(e=>console.warn('Referral stats unavailable',e));
        try{
          const {data:details,error:privateErr}=await client.from('khar_member_private')
            .select('first_name,last_name,birth_year,phone').eq('id',currentUser.id).maybeSingle();
          if(privateErr)throw privateErr;
          $('khPrivateFirstName').value=details?.first_name||'';
          $('khPrivateLastName').value=details?.last_name||'';
          $('khPrivateBirthYear').value=details?.birth_year||'';
          $('khPrivatePhone').value=details?.phone||'';
          $('khPrivateStatus').textContent='Ці відомості доступні тільки тобі.';
        }catch(e){
          $('khPrivateStatus').textContent='Приватні дані не завантажено: запусти SQL-файл оновлення у Supabase.';
          $('khPrivateForm').querySelector('button[type="submit"]').disabled=true;
          notify('Приватні дані не підключено',sanitizeError(e),true);
        }
      }catch(err){loading.hidden=true;displayError(err,'Не вдалося відкрити кабінет');}
    })();
    $('khEditBio')?.addEventListener('input',()=>{if($('khBioRemaining'))$('khBioRemaining').textContent=String($('khEditBio').value.length)+' / 1000 символів';});
    form?.addEventListener('submit',event=>{
      event.preventDefault();
      if(!currentUser||!currentProfile){notify('Профіль ще завантажується','Спробуй трохи пізніше.',true);return;}
      withButton(form,async()=>{
        const callsign=currentProfile.role==='founder'?'ГАРТ':$('khEditCallsign').value.trim();
        if(callsign.toLocaleLowerCase('uk-UA')==='гарт' && currentProfile.role!=='founder')throw new Error('Позивний ГАРТ зарезервовано за засновником.');
        const updates={callsign,display_as:addressDb($('khEditAddress').value),listed:$('khEditPublic').checked,bio:readOptional('khEditBio')||null};
        if((updates.bio||'').length>1000)throw new Error('Опис «Про себе» не може перевищувати 1000 символів.');
        const {data,error}=await client.from('khar_profiles')
          .update(updates).eq('id',currentUser.id)
          .select('id,member_no,callsign,display_as,rank,role,listed,bio').single();
        if(error)throw error;
        if(!data || data.callsign!==updates.callsign || data.display_as!==updates.display_as || Boolean(data.listed)!==updates.listed || (data.bio||null)!==updates.bio)
          throw new Error('База не підтвердила збереження усіх змін.');
        present(data);setMessage('✓ Зміни збережено у базі даних.');
        notify('Дані збережено!','Позивний, звертання, опис та видимість профілю оновлено.');
      });
    });
    $('khPrivateForm')?.addEventListener('submit',ev=>{
      ev.preventDefault();const f=ev.currentTarget;
      if(!currentUser)return notify('Увійди в акаунт','Спочатку увійди до свого профілю.',true);
      withButton(f,async()=>{
        const values={id:currentUser.id,first_name:cleanContact('Ім’я','khPrivateFirstName'),
          last_name:cleanContact('Прізвище','khPrivateLastName'),birth_year:birthYear('khPrivateBirthYear'),
          phone:contactPhone('khPrivatePhone')};
        const {data,error}=await client.from('khar_member_private').upsert(values,{onConflict:'id'})
          .select('id,first_name,last_name,birth_year,phone').single();
        if(error)throw error;
        if(!data||data.id!==currentUser.id)throw new Error('Збереження приватних відомостей не підтверджено.');
        $('khPrivateStatus').textContent='Приватні дані збережено.';
        notify('Приватні дані збережено!','Відомості доступні лише у твоєму кабінеті.');
      });
    });
    $('khChangePasswordForm')?.addEventListener('submit',ev=>{
      ev.preventDefault();const f=ev.currentTarget;
      if(!currentUser?.email)return notify('Сесія завершилася','Увійди знову.',true);
      withButton(f,async()=>{
        const current=$('khCurrentPassword').value;
        const next=$('khAccountNewPassword').value;
        const repeat=$('khAccountRepeatPassword').value;
        if(next.length<12)throw new Error('Новий пароль має містити щонайменше 12 символів.');
        if(next!==repeat)throw new Error('Нові паролі не збігаються.');
        if(next===current)throw new Error('Новий пароль має відрізнятися від старого.');
        const {error:verifyError}=await client.auth.signInWithPassword({email:currentUser.email,password:current});
        if(verifyError)throw new Error('Поточний пароль неправильний. Якщо забув його, віднови доступ через email.');
        const {error}=await client.auth.updateUser({password:next});
        if(error)throw error;
        f.reset();notify('Пароль змінено!','Новий пароль успішно збережено.');
      });
    });
    $('khLogout')?.addEventListener('click',async()=>{
      if(!client)return;
      try{const {error}=await client.auth.signOut();if(error)throw error;location.assign(link('login.html'));}
      catch(e){displayError(e,'Не вдалося вийти');}
    });
  }
  // «Поклик братства»: тільки безпечні підсумкові числа з власного RPC.
  async function loadMyReferrals(){
    const panel=$('khMyReferrals');
    if(!panel || !client)return;
    const status=$('khReferralStatus');
    const {data,error}=await client.rpc('khar_my_referral_stats');
    if(error){
      if(status)status.textContent='Не вдалося завантажити запрошення: '+sanitizeError(error);
      return;
    }
    const code=parseInvitationCode(data?.code);
    if(!code){if(status)status.textContent='Код запрошення ще не доступний.';return;}
    const num=(value)=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
    const registered=num(data.registered);
    const qualified=Math.min(registered,num(data.qualified));
    const next=data.next_goal===null?null:num(data.next_goal);
    const goals=[
      [1,'Перший поклик'],[5,'Іскра братства'],[25,'Творець єдності'],
      [100,'Голос братства'],[500,'Посланець єдності'],[1000,'Провідник однодумців'],
      [5000,'Крила братства'],[10000,'Легенда братства']
    ];
    const earned=goals.filter(([n])=>qualified>=n);
    const last=earned.length?earned[earned.length-1][0]:0;
    const nextName=next?goals.find(([n])=>n===next)?.[1]||'Наступний рубіж':'';
    const url=new URL(link('register.html'));
    url.searchParams.set('ref',code);
    const linkText=url.href;
    const set=(id,value)=>{if($(id))$(id).textContent=String(value);};
    set('khReferralRegistered',registered.toLocaleString('uk-UA'));
    set('khReferralQualified',qualified.toLocaleString('uk-UA'));
    set('khReferralUnqualified',(registered-qualified).toLocaleString('uk-UA'));
    set('khReferralCode',code);
    const input=$('khReferralLink');if(input)input.value=linkText;
    const prog=$('khReferralProgress');
    if(prog){
      const percent=next===null?100:Math.max(0,Math.min(100,Math.round(100*(qualified-last)/Math.max(next-last,1))));
      prog.style.width=percent+'%';
      const track=prog.parentElement;
      if(track){track.setAttribute('role','progressbar');track.setAttribute('aria-label','Прогрес до наступної відзнаки запрошень');
        track.setAttribute('aria-valuemin',String(last));track.setAttribute('aria-valuemax',String(next??last));
        track.setAttribute('aria-valuenow',String(qualified));}
    }
    set('khReferralGoal',next===null
      ?'Досягнуто найвищого передбаченого порога — 10 000 підтверджених запрошень!'
      :'Наступний рубіж: '+nextName+' · '+qualified.toLocaleString('uk-UA')+' / '+next.toLocaleString('uk-UA')+
        ' · залишилось '+(next-qualified).toLocaleString('uk-UA'));
    const badges=$('khReferralMilestones');
    if(badges){
      badges.replaceChildren();
      for(const [goal,name] of goals){
        const chip=document.createElement('span');
        chip.className='kh-ref-milestone'+(qualified>=goal?' achieved':'');
        chip.textContent=(qualified>=goal?'✓ ':'◇ ')+name+' · '+goal.toLocaleString('uk-UA');
        chip.title=qualified>=goal?'Відзнака отримана: відображається у твоїй публічній картці, якщо профіль відкритий.':'Потрібні підтверджені запрошення';
        badges.append(chip);
      }
    }
    const button=$('khReferralCopy');
    if(button){button.onclick=async()=>{
      try{
        if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(linkText);
        else if(input){input.focus();input.select();if(!document.execCommand('copy'))throw new Error('copy unsupported');}
        else throw new Error('copy unavailable');
        notify('Посилання скопійовано','Запрошуй друзів до братства!');
      }catch(e){if(input){input.focus();input.select();}notify('Виділи посилання','Скопіюй його вручну через Ctrl + C.',true);}
    };}
    if(status)status.textContent='Підрахунок захищений Supabase. Підтверджене запрошення — пошта + схвалене випробування «Пізнай братство».';
  }
  // «Шлях Характерника» v1: рішення й XP зберігаються тільки на сервері.
  function pathProgressCard(host,progress,compact=false){
    if(!host||!progress)return;
    host.replaceChildren();
    if(progress.founder){
      const h=document.createElement('strong');h.textContent='✦ Засновник · ГАРТ №001';
      const p=document.createElement('p');p.textContent='Ступені учасників не змінюють статус засновника.';
      const a=document.createElement('a');a.href=link('missions.html');a.textContent='⚔ Перевірити випробування ↗';
      host.append(h,p,a);return;
    }
    const xp=Math.max(0,Number(progress.xp)||0),lv=Math.min(3,Math.max(1,Number(progress.level)||1));
    const goal=Number(progress.next_goal)||500;
    const heading=document.createElement('div');heading.className='kh-path-progress-heading';
    const rank=document.createElement('strong');rank.textContent=(progress.rank||'Шукач')+' · Рівень '+['','I','II','III'][lv];
    const stars=document.createElement('span');stars.className='kh-path-stars';stars.textContent='✦'.repeat(lv)+'·'.repeat(3-lv);
    heading.append(rank,stars);
    const track=document.createElement('div');track.className='kh-path-track';track.setAttribute('role','progressbar');track.setAttribute('aria-label','Досвід до наступного етапу');
    track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(goal));track.setAttribute('aria-valuenow',String(Math.min(xp,goal)));
    const fill=document.createElement('span');fill.style.width=Math.min(100,Math.round(xp/goal*100))+'%';track.append(fill);
    const p=document.createElement('p');p.className='kh-path-progress-numbers';p.textContent=(xp>=500?'Перший етап завершено · ': 'Досвід: ')+xp+' / '+goal+' XP';
    const a=document.createElement('a');a.href=link('missions.html');a.textContent=compact?'Мої випробування ↗':'До випробувань ↗';
    host.append(heading,track,p,a);
    if(xp>=500){const note=document.createElement('small');note.textContent='Наступна ступінь «Гартівник» потребуватиме окремого випробування.';host.append(note);}
  }
  async function loadProfilePath(){
    const box=$('khProfilePath');if(!box||!client)return;
    try{const {data,error}=await client.rpc('khar_my_path_progress');if(error)throw error;pathProgressCard(box,data,true);}
    catch(e){box.textContent='Прогрес поки недоступний: перевір встановлення SQL 06.';console.warn('Path progress:',e);}
  }
  if(page==='missions'){
    const cards=$('khMissionCards'),status=$('khMissionStatus'),progressHost=$('khPathProgress');
    const admin=$('khMissionReviewSection'),queueHost=$('khMissionReviewList'),queueStatus=$('khMissionReviewStatus');
    let missions=[],submissions=[],viewerProfile=null;
    const missionText=statusCode=>({pending:'⌛ На перевірці',approved:'✓ Схвалено',rejected:'↻ Повернуто на доопрацювання'})[statusCode]||'Не подано';
    const dateFmt=value=>{try{return new Date(value).toLocaleDateString('uk-UA',{day:'2-digit',month:'short',year:'numeric'});}catch(e){return '—';}};
    const make=(tag,cl='',content)=>{const el=document.createElement(tag);if(cl)el.className=cl;if(content!==undefined)el.textContent=String(content);return el;};
    async function loadSubmissions(){
      if(!viewerProfile||viewerProfile.role==='founder'){submissions=[];return;}
      const {data,error}=await client.rpc('khar_my_mission_submissions');if(error)throw error;
      submissions=Array.isArray(data)?data:[];
    }
    function renderMissions(){
      cards.replaceChildren();
      if(!missions.length){status.textContent='Активних завдань наразі немає.';return;}
      status.textContent='Обирай завдання у зручному для себе темпі. Виконання перевіряє засновник.';
      missions.forEach((mission,i)=>{
        const own=submissions.find(s=>s.mission_code===mission.code);
        const card=make('article','kh-path-mission');
        const head=make('div','kh-path-mission-head');
        const index=make('span','kh-path-mission-index',String(i+1).padStart(2,'0'));
        const content=make('div');const title=make('h3','',mission.title);
        const desc=make('p','',mission.description);content.append(title,desc);
        const reward=make('strong','kh-path-mission-xp','+'+mission.xp_reward+' XP');
        head.append(index,content,reward);card.append(head);
        if(own){
          const tag=make('div','kh-path-mission-state kh-path-mission-'+own.status,missionText(own.status));
          card.append(tag);
          if(own.review_note){card.append(make('p','kh-path-mission-note','Коментар перевірки: '+own.review_note));}
          if(own.submitted_at)card.append(make('small','kh-path-mission-date','Подано '+dateFmt(own.submitted_at)));
        }
        const allowed=viewerProfile?.role==='member' && viewerProfile?.rank==='Шукач';
        if(allowed&&(!own||own.status==='rejected')){
          const form=make('form','kh-path-submit');
          const label=make('label','',own?'Онови опис виконаного завдання':'Розкажи, як виконав завдання');
          const textarea=make('textarea');textarea.name='evidence';textarea.rows=4;textarea.minLength=30;textarea.maxLength=1200;
          textarea.required=true;textarea.placeholder='Що зроблено, чому це було важливо, який результат… (30–1200 символів)';
          if(own?.status==='rejected')textarea.value=own.evidence||'';
          const note=make('small','','Не додавай чужі контакти або приватні подробиці.');
          const send=make('button','kh-path-submit-button',own?'Повторно надіслати ↗':'Надіслати на перевірку ↗');send.type='submit';
          label.append(textarea);form.append(label,note,send);card.append(form);
          form.addEventListener('submit',event=>{
            event.preventDefault();withButton(form,async()=>{
              const evidence=textarea.value.trim();
              if(evidence.length<30||evidence.length>1200)throw new Error('Напиши від 30 до 1200 символів.');
              const {error}=await client.rpc('khar_submit_mission',{p_code:mission.code,p_evidence:evidence});
              if(error)throw error;
              notify('Завдання надіслано','Засновник перевірить опис. XP з’являться тільки після схвалення.');
              await loadSubmissions();renderMissions();
            });
          });
        }else if(!viewerProfile){card.append(make('p','kh-path-mission-hint','Увійди, щоб надсилати виконані завдання.'));}
        else if(viewerProfile.role==='founder')card.append(make('p','kh-path-mission-hint','Засновник розглядає заявки у панелі нижче.'));
        else if(viewerProfile.rank!=='Шукач')card.append(make('p','kh-path-mission-hint','Цей етап призначений для ступеня «Шукач».'));
        cards.append(card);
      });
    }
    async function refreshProgress(){
      if(!viewerProfile||viewerProfile.role==='founder')return;
      const {data,error}=await client.rpc('khar_my_path_progress');if(error)throw error;
      pathProgressCard(progressHost,data);
    }
    async function refreshReviewQueue(){
      queueStatus.textContent='Завантажуємо заявки…';queueHost.replaceChildren();
      const {data,error}=await client.rpc('khar_mission_review_queue');if(error)throw error;
      queueStatus.textContent=data.length?('На перевірці: '+data.length+(data.length===100?' (показано перші 100)':'')):'Наразі немає заявок на перевірку.';
      (data||[]).forEach(item=>{
        const card=make('article','kh-path-review-card');
        const title=make('h3','',item.callsign+' · №'+formatNo(item.member_no));
        const mission=make('p','kh-path-review-mission',item.mission_title+' · +'+item.xp_reward+' XP');
        const submitted=make('small','', 'Подано: '+dateFmt(item.submitted_at));
        const evidence=make('p','kh-path-review-evidence',item.evidence);
        const label=make('label','','Коментар перевірки (для відмови обов’язковий)');
        const note=make('textarea');note.maxLength=500;note.rows=2;note.placeholder='Пояснення рішення (до 500 символів)';
        label.append(note);
        const actions=make('div','kh-path-review-actions');
        const approve=make('button','kh-path-approve','✓ Схвалити');approve.type='button';
        const reject=make('button','kh-path-reject','↻ Відхилити');reject.type='button';
        actions.append(approve,reject);card.append(title,mission,submitted,evidence,label,actions);queueHost.append(card);
        async function decide(accept){
          if(!accept && note.value.trim().length<5){notify('Вкажи причину відхилення','Щонайменше 5 символів.',true);note.focus();return;}
          approve.disabled=reject.disabled=true;
          try{
            const {data:result,error:reviewErr}=await client.rpc('khar_review_mission',{
              p_submission_id:item.submission_id,p_approve:accept,p_note:note.value.trim()||null
            });
            if(reviewErr)throw reviewErr;
            notify(accept?'Випробування схвалено':'Повернуто на доопрацювання',
              accept?'Учаснику зараховано +'+result.awarded_xp+' XP.':'Учасник побачить твоє пояснення.');
            await refreshReviewQueue();
          }catch(e){displayError(e,'Не вдалося зберегти рішення');approve.disabled=reject.disabled=false;}
        }
        approve.addEventListener('click',()=>decide(true));reject.addEventListener('click',()=>decide(false));
      });
    }
    $('khMissionReviewReload')?.addEventListener('click',()=>refreshReviewQueue().catch(e=>{queueStatus.textContent=sanitizeError(e);notify('Не вдалося завантажити заявки',sanitizeError(e),true);}));
    (async()=>{
      if(!client){progressHost.textContent='Сервіс тимчасово недоступний. Перевір з’єднання з Supabase.';status.textContent='Випробування не завантажено.';return;}
      try{
        const {data:missionsData,error:missionsErr}=await client.from('khar_missions')
          .select('code,title,description,xp_reward,sort_order').eq('active',true).order('sort_order');
        if(missionsErr)throw missionsErr;
        missions=missionsData||[];
        const {data:sessionData,error:sessionErr}=await client.auth.getSession();
        if(sessionErr)throw sessionErr;
        if(sessionData?.session?.user){
          viewerProfile=await getMyProfile(sessionData.session.user);
          if(viewerProfile.role==='founder'){
            pathProgressCard(progressHost,{founder:true});admin.hidden=false;
            await refreshReviewQueue();
          }else{
            await Promise.all([loadSubmissions(),refreshProgress()]);
          }
        }else{
          progressHost.replaceChildren();
          progressHost.append(make('p','','Увійди до акаунта, щоб почати шлях і бачити свої XP.'));
          const login=make('a','','Увійти ↗');login.href=link('login.html');progressHost.append(login);
        }
        renderMissions();
      }catch(e){
        const message=sanitizeError(e);
        status.textContent='Не вдалося завантажити систему випробувань: '+message+'. Спочатку встанови SQL 06 у Supabase.';
        progressHost.textContent='Дані прогресу недоступні.';
        notify('Не вдалося відкрити випробування',message,true);
      }
    })();
  }

  if(page==='members'){
    const list=$('khPublicMembersList'),search=$('khMemberSearch'),counter=$('khDirectoryCount'),
      empty=$('khMembersEmpty'),filter=$('khRankFilter'),total=$('khPublicTotal'),variety=$('khRankVariety');
    let entries=[];
    function row(p){
      const li=document.createElement('li');li.className='kh-member-row';
      const avatar=document.createElement('div');chevronFor(p,avatar,true);
      const details=document.createElement('div');details.className='kh-member-profile';
      const name=document.createElement('strong');name.className='kh-member-name';name.textContent=p.callsign||'Без позивного';
      const sub=document.createElement('div');sub.className='kh-member-sub';
      const no=document.createElement('span');no.className='kh-member-id';no.textContent='№'+formatNo(p.member_no);
      const rank=document.createElement('span');rank.className='kh-rank';rank.textContent=p.rank||'Шукач';
      const badge=document.createElement('span');badge.className='kh-identity-badge '+(p.display_as==='posestra'?'kh-identity-sister':'kh-identity-brother');
      badge.textContent=(p.display_as==='posestra'?'✿ ':p.display_as==='pobratym'?'✦ ':'◇ ')+addressLabel(p.display_as);
      sub.append(no,rank,badge);
      if(p.role==='founder'&&Number(p.member_no)===1){
        const special=document.createElement('span');special.className='kh-directory-honor';special.textContent='✦ Засновник';sub.append(special);
        li.classList.add('kh-founder-row');
      }else if(isAnastesha(p)){
        const special=document.createElement('span');special.className='kh-directory-honor';special.textContent='✦ Перша посестра';sub.append(special);
        li.classList.add('kh-first-sister-row');
      }
      details.append(name,sub);li.append(avatar,details);
      const go=document.createElement('a');go.href=(p.role==='founder'&&Number(p.member_no)===1)?link('founder.html'):link('member.html?no='+encodeURIComponent(p.member_no));
      go.className='kh-directory-profile-link';go.textContent='Картка ↗';go.setAttribute('aria-label','Відкрити картку '+(p.callsign||'учасника'));li.append(go);
      return li;
    }
    function render(){
      const q=(search?.value||'').trim().toLocaleLowerCase('uk-UA');
      const selected=filter?.value||'';
      const subset=entries.filter(p=>(!selected||(p.rank||'Шукач')===selected)
        &&[p.callsign||'',p.rank||'Шукач',addressLabel(p.display_as),String(p.member_no),formatNo(p.member_no)].join(' ').toLocaleLowerCase('uk-UA').includes(q));
      list.replaceChildren(...subset.map(row));
      counter.textContent='Знайдено: '+subset.length+' із '+entries.length;
      empty.hidden=subset.length!==0;
    }
    // Особистий XP із серверної RPC; чужі XP не завантажуємо без окремого публічного API.
    async function loadHallOwnProgress(){
      const host=$('khHallOwnProgress');if(!host)return;
      if(!client){host.textContent='Немає підключення до Supabase.';return;}
      try{
        const user=await getUser();
        if(!user){
          host.replaceChildren();
          const message=document.createElement('p');message.textContent='Увійди, щоб побачити власні XP та рівень.';
          const a=document.createElement('a');a.href=link('login.html');a.textContent='Увійти ↗';
          host.append(message,a);return;
        }
        const {data,error}=await client.rpc('khar_my_path_progress');
        if(error)throw error;
        if(!data){host.textContent='Особистий прогрес поки недоступний.';return;}
        pathProgressCard(host,data,true);
      }catch(e){
        host.textContent='Не вдалося отримати XP. Перевір SQL 06 та підключення до Supabase.';
        console.warn('Hall personal progress:',e);
      }
    }
    loadHallOwnProgress();
    if(client)client.auth.onAuthStateChange(()=>setTimeout(()=>loadHallOwnProgress(),0));
    search?.addEventListener('input',render);
    filter?.addEventListener('change',render);
    (async()=>{
      try{
        entries=(await publicProfiles()).filter(p=>p.callsign);
        const ranks=[...new Set(entries.map(p=>p.rank||'Шукач'))].sort((a,b)=>a.localeCompare(b,'uk'));
        if(total)total.textContent=String(entries.length);
        if(variety)variety.textContent=String(ranks.length);
        if(filter){for(const rank of ranks){const option=document.createElement('option');option.value=rank;option.textContent=rank;filter.append(option);}}
        render();
      }catch(e){
        counter.textContent='Не вдалося завантажити реєстр';
        if(empty){empty.hidden=false;empty.querySelector('p').textContent='Не вдалося завантажити профілі. Спробуйте оновити сторінку.';}
        notify('Не вдалося завантажити учасників',sanitizeError(e),true);
      }
    })();
  }

  // Реакції та обговорення. Публічний перегляд, дії тільки від авторизованих власників публічних профілів.
  function showDiscussionProblem(problem){
    const section=$('khDiscussion');if(!section)return;
    section.hidden=false;
    const message=$('khDiscussionStatus');if(message)message.textContent=problem;
    const button=$('khSupportButton');if(button)button.disabled=true;
    const form=$('khCommentForm');if(form)form.hidden=true;
  }
  async function initDiscussion(target){
    const section=$('khDiscussion');
    if(!section)return;
    if(!target?.id || !client){showDiscussionProblem('Обговорення тимчасово недоступне: не вдалося отримати публічний профіль або підключитися до Supabase.');return;}
    const countNode=$('khSupportCount'),supportButton=$('khSupportButton'),commentsNode=$('khComments'),
      message=$('khDiscussionStatus'),form=$('khCommentForm'),login=$('khCommentLogin'),
      privateNote=$('khCommentPublic'),commentCount=$('khCommentCount'),editor=$('khCommentBody');
    section.hidden=false;
    let viewer=null,myProfile=null,hasSupport=false;
    try{
      const {data}=await client.auth.getUser();viewer=data?.user||null;
      if(viewer){try{myProfile=await getMyProfile(viewer);}catch(e){console.warn('Discussion viewer profile unavailable');}}
    }catch(e){/* Неавторизованому відвідувачу дозволено читати публічні обговорення. */}
    const allowed=Boolean(viewer && myProfile?.listed && myProfile?.callsign);
    login.hidden=Boolean(viewer);privateNote.hidden=!viewer || allowed;
    form.hidden=!allowed;
    if(allowed){editor.addEventListener('input',()=>{$('khCommentRemaining').textContent=editor.value.length+' / 1000';});}

    async function updateSupport(){
      const {data,error}=await client.rpc('khar_support_count',{target_profile_id:target.id});
      if(error)throw error;
      countNode.textContent=Number(data||0).toLocaleString('uk-UA');
      if(allowed){
        const {data:mine,error:mineErr}=await client.from('khar_profile_support')
          .select('profile_id').eq('profile_id',target.id).eq('supporter_id',viewer.id).maybeSingle();
        if(mineErr)throw mineErr;hasSupport=Boolean(mine);
        const own=target.id===viewer.id;
        supportButton.disabled=own;supportButton.classList.toggle('is-active',hasSupport);
        supportButton.textContent=own?'✓ Твій профіль':hasSupport?'✓ Підтримано':'🤝 Підтримати';
        supportButton.title=own?'Власний профіль не можна підтримати.':'';
      }else{supportButton.textContent='🤝 Підтримати';supportButton.disabled=true;}
    }
    supportButton?.addEventListener('click',async()=>{
      if(!allowed || target.id===viewer?.id)return;
      supportButton.disabled=true;
      try{
        const q=hasSupport
          ? client.from('khar_profile_support').delete().eq('profile_id',target.id).eq('supporter_id',viewer.id)
          : client.from('khar_profile_support').insert({profile_id:target.id,supporter_id:viewer.id});
        const {error}=await q;if(error)throw error;
        notify(hasSupport?'Підтримку скасовано':'Дякуємо за підтримку!');
        await updateSupport();
        // Нові відзнаки за поріг підтримок одразу видно після натискання.
        await loadProfileBadges(target);
      }catch(e){displayError(e,'Підтримку не оновлено');}
      finally{if(allowed && viewer.id!==target.id)supportButton.disabled=false;}
    });

    function commentCard(comment,people,rootId,depth=0){
      const author=people.get(comment.author_id);
      const wrap=document.createElement('article');wrap.className='kh-comment-item'+(depth?' is-reply':'');
      const meta=document.createElement('div');meta.className='kh-comment-meta';
      const name=document.createElement('span');name.className='kh-comment-name';name.textContent=author?.callsign||'Учасник';
      const number=document.createElement('span');number.className='kh-comment-number';number.textContent=author?'№'+formatNo(author.member_no):'';
      const date=document.createElement('time');date.className='kh-comment-date';date.dateTime=comment.created_at;
      date.textContent=new Date(comment.created_at).toLocaleString('uk-UA',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
      meta.append(name,number,date);
      const body=document.createElement('p');body.className='kh-comment-body';body.textContent=comment.body;
      const actions=document.createElement('div');actions.className='kh-comment-actions';
      if(allowed){
        const reply=document.createElement('button');reply.type='button';reply.textContent='↪ Відповісти';
        reply.addEventListener('click',()=>{
          $('khReplyToId').value=rootId; $('khReplyText').textContent='Відповідь на обговорення від '+(author?.callsign||'учасника');
          $('khReplyBanner').hidden=false;editor.focus();form.scrollIntoView({behavior:'smooth',block:'center'});
        });actions.append(reply);
        if(comment.author_id===viewer.id || myProfile?.role==='founder'){
          const remove=document.createElement('button');remove.type='button';remove.textContent='Видалити';
          remove.addEventListener('click',async()=>{
            if(!confirm('Видалити коментар та відповіді до нього?'))return;
            remove.disabled=true;
            const {error}=await client.from('khar_profile_comments').delete().eq('id',comment.id);
            if(error)displayError(error,'Не вдалося видалити коментар');
            else{notify('Коментар видалено');await updateComments();}
            remove.disabled=false;
          });actions.append(remove);
        }else{
          const report=document.createElement('button');report.type='button';report.textContent='Поскаржитись';
          report.addEventListener('click',async()=>{
            const reason=prompt('Чому цей коментар порушує правила спільноти? (5–500 символів)');
            if(reason===null)return;
            if(reason.trim().length<5 || reason.trim().length>500){notify('Перевір опис скарги','Від 5 до 500 символів.',true);return;}
            const {error}=await client.from('khar_comment_reports').insert({comment_id:comment.id,reporter_id:viewer.id,reason:reason.trim()});
            if(error)displayError(error,'Скаргу не надіслано');else notify('Скаргу зафіксовано','Засновник зможе переглянути її під час модерації.');
          });actions.append(report);
        }
      }
      wrap.append(meta,body,actions);return wrap;
    }
    async function updateComments(){
      message.textContent='Завантажуємо обговорення…';
      try{
        const {data:rows,error,count}=await client.from('khar_profile_comments')
          .select('id,profile_id,author_id,parent_id,body,created_at',{count:'exact'})
          .eq('profile_id',target.id).order('created_at',{ascending:false}).limit(80);
        if(error)throw error;
        const all=(rows||[]).reverse(),ids=[...new Set(all.map(x=>x.author_id))];let authors=[];
        if(ids.length){
          const {data,error:authorError}=await client.from('khar_profiles')
            .select('id,callsign,member_no').in('id',ids).eq('listed',true);
          if(authorError)throw authorError;authors=data||[];
        }
        const people=new Map(authors.map(a=>[a.id,a]));
        commentsNode.replaceChildren();
        const visibleIds=new Set(all.map(c=>c.id));
        const roots=all.filter(c=>!c.parent_id || !visibleIds.has(c.parent_id));
        const children=new Map();
        for(const c of all){if(c.parent_id && visibleIds.has(c.parent_id)){if(!children.has(c.parent_id))children.set(c.parent_id,[]);children.get(c.parent_id).push(c);}}
        const seen=new Set();
        function show(c,root,depth){if(seen.has(c.id) || seen.size>100)return;seen.add(c.id);
          commentsNode.append(commentCard(c,people,root,depth));
          for(const child of children.get(c.id)||[])show(child,root,Math.min(depth+1,1));
        }
        for(const c of roots)show(c,c.id,0);
        commentCount.textContent=String(count||0);
        message.textContent=all.length?'Останні повідомлення учасників.':'Обговорення ще немає. Залиши першу думку!';
        if((count||0)>80)message.textContent+=' Показано останні 80 повідомлень.';
      }catch(e){message.textContent='Не вдалося завантажити обговорення: '+sanitizeError(e);}
    }
    $('khReplyCancel')?.addEventListener('click',()=>{$('khReplyToId').value='';$('khReplyBanner').hidden=true;});
    $('khDiscussionRefresh')?.addEventListener('click',()=>{updateComments();updateSupport().catch(e=>notify('Не вдалося оновити підтримку',sanitizeError(e),true));});
    form?.addEventListener('submit',ev=>{
      ev.preventDefault();if(!allowed)return;
      withButton(form,async()=>{
        const body=editor.value.trim();if(!body || body.length>1000)throw new Error('Коментар має містити від 1 до 1000 символів.');
        const parent_id=$('khReplyToId').value||null;
        const {error}=await client.from('khar_profile_comments').insert({profile_id:target.id,author_id:viewer.id,parent_id,body});
        if(error)throw error;
        editor.value='';$('khCommentRemaining').textContent='0 / 1000';$('khReplyToId').value='';$('khReplyBanner').hidden=true;
        notify('Коментар опубліковано!');await updateComments();
      });
    });
    updateSupport().catch(e=>{countNode.textContent='—';supportButton.disabled=true;message.textContent='Спершу виконай SQL-оновлення 03 в Supabase.';console.warn('Support unavailable',e);});
    await updateComments();
  }

  // «Провідники братства»: лише серверні агрегати відкритих профілів.
  // Жодних UUID, email чи списків запрошених клієнт не отримує.
  if(page==='leaders'){
    let selected='all',request=0;
    const all=$('khLeadersAll'),month=$('khLeadersMonth');
    const list=$('khLeadersList'),status=$('khLeadersStatus'),period=$('khLeadersPeriod');
    const nf=new Intl.NumberFormat('uk-UA');
    const render=async()=>{
      const seq=++request;
      all?.setAttribute('aria-pressed',String(selected==='all'));
      month?.setAttribute('aria-pressed',String(selected==='month'));
      if(period){period.textContent=selected==='month'
        ?'Зараховані у '+new Intl.DateTimeFormat('uk-UA',{month:'long',year:'numeric',timeZone:'Europe/Kyiv'}).format(new Date())+' (час Києва).'
        :'Підсумок підтверджених запрошень за весь час.';}
      if(status)status.textContent='Завантажуємо рейтинг…';
      if(list)list.replaceChildren();
      if(!client){if(status)status.textContent='Сервіс рейтингу зараз недоступний.';return;}
      const {data,error}=await client.rpc('khar_referral_leaderboard',{p_period:selected,p_limit:20});
      if(seq!==request)return;
      if(error){if(status)status.textContent='Не вдалося завантажити рейтинг: '+sanitizeError(error);return;}
      if(!data?.length){if(status)status.textContent='Поки немає підтверджених запрошень за цей період. Перший поклик — попереду!';return;}
      if(status)status.textContent='Показано '+data.length+' учасників із підтвердженими запрошеннями.';
      for(let i=0;i<data.length;i++){
        const p=data[i];
        const n=Number(p.member_no),count=Number(p.qualified_invites);
        if(!Number.isSafeInteger(n)||n<1||!Number.isSafeInteger(count)||count<1)continue;
        const li=document.createElement('li');li.className='kh-leader-row'+(i<3?' kh-leader-top-'+(i+1):'');
        const place=document.createElement('span');place.className='kh-leader-place';
        place.textContent=i===0?'I':i===1?'II':i===2?'III':String(i+1);
        const detail=document.createElement('div');detail.className='kh-leader-person';
        const name=document.createElement('a');
        name.href=link(n===1?'founder.html':'member.html?no='+encodeURIComponent(String(n)));
        name.textContent=String(p.callsign||'Учасник');
        const label=document.createElement('small');label.textContent='№'+formatNo(n)+' · '+addressLabel(p.display_as);
        detail.append(name,label);
        const score=document.createElement('strong');score.className='kh-leader-score';
        score.textContent=nf.format(count);
        score.title='Підтверджені запрошення';
        li.append(place,detail,score);list.append(li);
      }
    };
    all?.addEventListener('click',()=>{selected='all';render().catch(e=>console.warn(e));});
    month?.addEventListener('click',()=>{selected='month';render().catch(e=>console.warn(e));});
    render().catch(e=>{if(status)status.textContent='Не вдалося завантажити рейтинг: '+sanitizeError(e);});
  }

  // Відзнаки завжди завантажуються з БД; клієнт ніколи не надає їх напряму.
  function renderAwardChips(badges, host){
    if(!host)return;
    host.replaceChildren();
    if(!badges.length){const blank=document.createElement('span');blank.className='kh-awards-pending';
      blank.textContent='Відзнак поки немає. Усе починається з вчинків.';host.append(blank);return;}
    for(const badge of badges){
      const item=document.createElement('span');
      item.className='kh-award-chip kh-'+(badge.kind==='community'?'community':badge.kind==='referral'?'referral':badge.kind==='manual'?'manual':'rank')+(badge.code==='team_member'?' kh-team-member':'');
      item.setAttribute('role','listitem');item.title=badge.description||badge.title;
      const icon=document.createElement('span');icon.className='kh-award-glyph';
      if(badge.code==='team_member'){
        // Знак офіційної команди: справжній український Тризуб у чорному щиті
        // з тонким золотим контуром. Вбудований SVG, без емодзі «вила».
        const ns='http://www.w3.org/2000/svg';
        const shape=(tag,attrs)=>{
          const node=document.createElementNS(ns,tag);
          for(const [key,val] of Object.entries(attrs))node.setAttribute(key,String(val));
          return node;
        };
        const svg=shape('svg',{
          viewBox:'0 0 48 56',width:24,height:28,
          'aria-hidden':'true',focusable:'false'
        });
        svg.style.cssText='display:block;flex:none;overflow:visible';
        const shieldPath='M24 2.5C31.2 6.5 37.5 7.5 44 9.1V28.7C44 40.1 35.8 47.9 24 53C12.2 47.9 4 40.1 4 28.7V9.1C10.5 7.5 16.8 6.5 24 2.5Z';
        const shield=shape('path',{
          d:shieldPath,fill:'#0B1213',stroke:'#E3BA6A','stroke-width':1.65,
          'stroke-linejoin':'round'
        });
        const inside=shape('path',{
          d:'M24 6.9C30.5 10.1 36.2 11.3 40 12.2V28.4C40 37 33.4 44.3 24 48.5C14.6 44.3 8 37 8 28.4V12.2C11.8 11.3 17.5 10.1 24 6.9Z',
          fill:'none',stroke:'#9A7339','stroke-width':0.65,'stroke-linejoin':'round'
        });
        const tryzub=shape('svg',{
          x:12,y:11,width:24,height:34,viewBox:'80 40 500 830',
          preserveAspectRatio:'xMidYMid meet'
        });
        const tryzubShape='m329 53c-6 4-2 396 0 401 12 43 29 81 48 112-104 31-63 146-48 287 7-12 17-21 28-28 43-34 70-81 79-132h133v-580c-148 88-132 213-148 361 59-10 75 76-3 83-92-149-59-257-59-419 0-37-9-62-30-85zm200 143v297h-22c-6-23-21-41-42-51 8-85 10-189 64-246zm-22 337h22v120h-89c0-19-3-39-8-58 36-4 68-29 75-62zm-114 71c4 16 6 33 6 49h-50c1-27 19-44 44-49zm-44 89h46c-7 31-23 61-46 85z';
        const half=shape('path',{d:tryzubShape,fill:'#F2C875'});
        const mirrored=shape('path',{
          d:tryzubShape,fill:'#F2C875',transform:'translate(658 0) scale(-1 1)'
        });
        tryzub.append(half,mirrored);
        svg.append(shield,inside,tryzub);
        icon.append(svg);
      }else icon.textContent=badge.symbol||'✦';
      const label=document.createElement('span');label.textContent=badge.title||'Відзнака';
      item.append(icon,label);host.append(item);
    }
  }
  async function loadProfileBadges(profile){
    const host=$('khBadgesList');if(!host||!profile||!client)return;
    try{
      const {data,error}=await client.rpc('khar_list_badges',{target_member_no:Number(profile.member_no)});
      if(error)throw error;
      renderAwardChips(data||[],host);
      if(Number(profile.member_no)===1 && profile.role==='founder'){
        const nextNode=$('khNextBadge');
        const {data:count,error:countError}=await client.rpc('khar_support_count',{target_profile_id:profile.id});
        if(!countError&&nextNode){
          const n=Number(count)||0;const next=[100,1000,5000,10000,50000,100000,250000,500000,1000000].find(x=>x>n);
          nextNode.hidden=!next;
          if(next)nextNode.textContent='Наступна відзнака від спільноти: '+new Intl.NumberFormat('uk-UA').format(next)+' підтримок (ще '+new Intl.NumberFormat('uk-UA').format(next-n)+').';
        }
      }
    }catch(error){
      console.warn('Awards unavailable',error);
      host.textContent='Відзнаки ще не налаштовано. Перевір SQL 04.';
    }
  }
  async function initAwardsAdmin(){
    const gate=$('khAwardsGate'),dashboard=$('khAwardsAdmin'),members=$('khAwardsMember'),codes=$('khAwardsCode'),
      form=$('khAwardsForm'),current=$('khAwardsCurrent');
    if(!client){gate.textContent='Немає підключення до Supabase.';return;}
    try{
      const viewer=await getUser();
      if(!viewer)throw new Error('Спочатку увійди до свого акаунта.');
      const profile=await getMyProfile(viewer);
      if(!(profile.role==='founder'&&Number(profile.member_no)===1))throw new Error('Керувати відзнаками може тільки ГАРТ №001.');
      const [{data:catalog,error:catError},profiles]=await Promise.all([
        client.rpc('khar_list_manual_badges'),publicProfiles()
      ]);
      if(catError)throw catError;
      const eligible=profiles.filter(p=>p.role==='member'&&p.callsign);
      members.replaceChildren();codes.replaceChildren();
      for(const p of eligible){const opt=document.createElement('option');opt.value=String(p.member_no);opt.textContent='№'+formatNo(p.member_no)+' · '+p.callsign;members.append(opt);}
      for(const b of catalog||[]){const opt=document.createElement('option');opt.value=b.code;opt.textContent=b.code==='team_member'?b.title+' · Тризуб у щиті':(b.symbol||'✦')+' '+b.title;opt.title=b.description;codes.append(opt);}
      gate.hidden=true;dashboard.hidden=false;
      const refresh=async()=>{
        if(!members.value){current.textContent='Немає відкритих профілів для нагородження.';return;}
        const {data,error}=await client.rpc('khar_list_badges',{target_member_no:Number(members.value)});
        if(error)throw error;renderAwardChips(data||[],current);
      };
      members.addEventListener('change',()=>refresh().catch(e=>displayError(e)));
      form.addEventListener('submit',ev=>{
        ev.preventDefault();withButton(form,async()=>{
          if(!members.value||!codes.value)throw new Error('Вибери учасника й відзнаку.');
          const granted=$('khAwardsAction').value==='grant';
          const {error}=await client.rpc('khar_set_badge',{
            target_member_no:Number(members.value),target_badge_code:codes.value,make_active:granted
          });if(error)throw error;
          notify(granted?'Відзнаку вручено!':'Відзнаку відкликано.','Зміни збережено у Supabase.');
          await refresh();
        });
      });
      await refresh();
    }catch(err){gate.textContent=sanitizeError(err);}
  }
  if(page==='awards')initAwardsAdmin().catch(e=>displayError(e));

  if(page==='member'){
    const loading=$('khMemberDetailLoading'),panel=$('khMemberDetail');
    (async()=>{
      try{
        if(!client)throw new Error('Сервіс публічних профілів наразі недоступний.');
        const n=Number(new URLSearchParams(location.search).get('no'));
        if(!Number.isSafeInteger(n)||n<1||n>999999999)throw new Error('Невірний номер учасника.');
        if(n===1){location.replace(link('founder.html'));return;}
        const {data,error}=await client.from('khar_profiles')
          .select('id,member_no,callsign,display_as,rank,role,bio')
          .eq('listed',true).eq('member_no',n).maybeSingle();
        if(error)throw error;
        if(!data||!data.callsign)throw new Error('Картка прихована або не існує. Учасник міг змінити налаштування приватності.');
        chevronFor(data,$('khMemberDetailChevron'));
        $('khMemberDetailCaption').textContent=chevronCaption(data);
        $('khMemberDetailName').textContent=data.callsign;
        $('khMemberDetailNo').textContent='№'+formatNo(data.member_no);
        $('khMemberDetailAddress').textContent=addressLabel(data.display_as);
        $('khMemberDetailRank').textContent='Ранг: '+(data.rank||'Шукач');
        $('khMemberDetailBadge').textContent=isAnastesha(data)?'✿ ПЕРША ПОСЕСТРА · ОСОБИСТИЙ ШЕВРОН':'✦ УЧАСНИК БРАТСТВА';
        const about=$('khMemberDetailAbout');
        if(about){about.hidden=!data.bio; $('khMemberDetailBio').textContent=data.bio||'';}
        $('khMemberDetailInfo').textContent=isAnastesha(data)
          ?'ANASTESHA — перша посестра спільноти «Характерник». Особистий шеврон №002 — пам’ятна відзнака, а офіційний ранг зараз «'+(data.rank||'Шукач')+'».'
          :'Кожен учасник має власний шлях. Відзнака відображає його поточний ранг у братстві.';
        panel.hidden=false;loading.hidden=true;
        loadProfileBadges(data);
        initDiscussion(data).catch(e=>{console.warn('Discussion init failed',e);showDiscussionProblem('Не вдалося відкрити обговорення: '+sanitizeError(e));});
      }catch(err){loading.textContent=sanitizeError(err);notify('Не вдалося відкрити картку',sanitizeError(err),true);}
    })();
  }

  if(page==='founder'){
    (async()=>{
      if(!client){showDiscussionProblem('Обговорення недоступне: не вдалося підключити Supabase. Перевір config.js.');return;}
      try{
        const {data,error}=await client.from('khar_profiles').select('id,member_no,callsign,bio')
          .eq('member_no',1).eq('role','founder').eq('listed',true).maybeSingle();
        if(error)throw error;
        if(!data){showDiscussionProblem('Обговорення недоступне: публічний профіль ГАРТ №001 не знайдено.');return;}
        if(data.bio){$('khFounderBio').textContent=data.bio;$('khFounderAbout').hidden=false;}
        loadProfileBadges(data);
        await initDiscussion(data);
        try{const viewer=await getUser();if(viewer){const owner=await getMyProfile(viewer);
          if(owner.role==='founder'&&Number(owner.member_no)===1 && $('khAwardsAdminLink'))$('khAwardsAdminLink').hidden=false;
        }}catch(e){/* У гостей немає кнопки керування */}
      }catch(e){console.warn('Founder discussion unavailable',e);showDiscussionProblem('Не вдалося завантажити обговорення: '+sanitizeError(e));}
    })();
  }
  if(page==='index'){
    (async()=>{
      try{const entries=await publicProfiles();
        if($('khMembers')){$('khMembers').textContent=String(entries.length);$('khMembers').parentElement.title='Кількість публічних профілів, не всі зареєстровані';}
      }catch(e){/* не підмінюємо реальні дані вигаданими */}
    })();
    // Без бекенду реального часу показники залишаються прочерками.
    if(cfg.statsEndpoint){
      (async()=>{try{const r=await fetch(cfg.statsEndpoint,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);const d=await r.json();
        for(const [node,val] of [['khOnline',d.online],['khViews',d.views]])if(Number.isSafeInteger(val)&&val>=0 && $(node))$(node).textContent=Intl.NumberFormat('uk-UA').format(val);
      }catch(e){console.warn('Статистика поки недоступна');}})();
    }
  }
  if(page==='donate'){
    const coins={USDT:{label:'USDT / TRC20',chain:'Tron (TRC20)'},BTC:{label:'BTC / Bitcoin',chain:'Bitcoin'},ETH:{label:'ETH / Ethereum',chain:'Ethereum Mainnet'}};
    let current='USDT';
    function wallet(){
      const address=safeText(cfg.wallets?.[current]).trim();$('walletTitle').textContent=coins[current].label;
      $('walletAddress').textContent=address || 'Адресу гаманця ще не додано';
      $('copyWallet').disabled=!address;
      $('walletStatus').textContent=address?'Уважно перевір мережу перед переказом.':'Прийом донатів поки не активний.';
      $('qrBox').replaceChildren();
      if(address){const im=document.createElement('img');im.alt='QR-код '+coins[current].label;
        im.src='https://api.qrserver.com/v1/create-qr-code/?size=160x160&data='+encodeURIComponent(address);
        im.onerror=()=>{$('qrBox').textContent='QR-код недоступний. Копіюй адресу вручну.';};$('qrBox').append(im);}
      else $('qrBox').textContent='▦ QR-код з’явиться після додавання адреси';
      document.querySelectorAll('.wallet-tab').forEach(t=>{t.classList.toggle('active',t.dataset.coin===current);t.setAttribute('aria-selected',String(t.dataset.coin===current));});
    }
    document.querySelectorAll('.wallet-tab').forEach(t=>t.addEventListener('click',()=>{current=t.dataset.coin;wallet();}));
    $('copyWallet')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(cfg.wallets[current]);notify('Адресу скопійовано',coins[current].label);}
      catch(e){notify('Не вдалося скопіювати','Виділи адресу вручну.',true);}});
    wallet();
    const txs=Array.isArray(cfg.transactions)?cfg.transactions:[];
    $('reportTotal').textContent=String(txs.length);
    $('reportIncome').textContent=String(txs.filter(t=>t.type==='income').length);
    $('reportExpense').textContent=String(txs.filter(t=>t.type==='expense').length);
    if(txs.length){
      const tbody=$('reportRows');tbody.replaceChildren();
      for(const t of txs){const tr=document.createElement('tr');
        for(const v of [t.date||'',t.type==='income'?'Надходження':'Витрата',`${t.coin||''} ${t.amount||''}`,t.purpose||'']){let td=document.createElement('td');td.textContent=v;tr.append(td);}
        const proof=document.createElement('td');if(/^https:\/\//.test(t.proof||'')){const a=document.createElement('a');a.href=t.proof;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Перевірити ↗';proof.append(a);}else proof.textContent='—';tr.append(proof);tbody.append(tr);
      }
    }
  }
  if(page==='password'){
    const request=$('khResetRequest'),change=$('khNewPasswordForm');
    let hasRecovery=false;
    const beginRecovery=()=>{hasRecovery=true;request.hidden=true;change.hidden=false;setMessage('Введи та підтвердь новий пароль.');};
    if(client){
      client.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')beginRecovery();});
      // For recovery links with code, JS SDK exchanges the code asynchronously.
      // The PASSWORD_RECOVERY event above is the confirmation.
    }
    request?.addEventListener('submit',ev=>{ev.preventDefault();withButton(request,async()=>{
      if(!client)throw new Error('Немає підключення до Supabase.');
      const {error}=await client.auth.resetPasswordForEmail($('khResetEmail').value.trim(),{redirectTo:link('password.html')});
      if(error)throw error;
      setMessage('Якщо адреса існує, посилання для відновлення надіслано. Перевір пошту.');
      notify('Перевір пошту','Надіслано посилання для відновлення, якщо адреса зареєстрована.');
    });});
    change?.addEventListener('submit',ev=>{ev.preventDefault();withButton(change,async()=>{
      if(!client||!hasRecovery)throw new Error('Спочатку відкрий посилання відновлення з листа.');
      const pass=$('khNewPassword').value;if(pass!==$('khNewPasswordRepeat').value)throw new Error('Паролі не збігаються.');
      const {error}=await client.auth.updateUser({password:pass});if(error)throw error;
      change.reset();setMessage('Пароль змінено. Можеш увійти з новими даними.');notify('✓ Пароль змінено','Переходь на сторінку входу.');
      setTimeout(()=>location.assign(link('login.html')),1300);
    });});
  }
})();
