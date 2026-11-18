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
      client=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey);
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
  if(page==='register'){
    const form=$('khRegisterForm');
    form?.addEventListener('submit',event=>{
      event.preventDefault();
      withButton(form,async()=>{
        const callsign=$('khNewCallsign').value.trim();
        if(callsign.toLocaleLowerCase('uk-UA')==='гарт')throw new Error('Позивний ГАРТ зарезервований за засновником №001.');
        const selected=form.querySelector('input[name="khRegAddress"]:checked');
        const chosen=addressDb(selected?.value || 'Учасник');
        const {data,error}=await client.auth.signUp({
          email:$('khRegEmail').value.trim(), password:$('khRegPassword').value,
          options:{emailRedirectTo:link('login.html'), data:{callsign, display_as:chosen,
            khar_given_name:cleanContact('Ім’я','khRegFirstName'),
            khar_family_name:cleanContact('Прізвище','khRegLastName'),
            khar_birth_year:birthYear('khRegBirthYear'),
            khar_phone:contactPhone('khRegPhone')}}
        });
        if(error)throw error;
        // No fake success if Supabase did not provide a user.
        if(!data?.user)throw new Error('Підтвердження реєстрації не отримано.');
        form.reset();
        if(data.session){setMessage('Профіль створено. Перенаправляємо до кабінету.');notify('Реєстрацію завершено','Відкриваємо твій кабінет.');setTimeout(()=>location.assign(link('profile.html')),850);}
        else{setMessage('Перевір електронну пошту та підтверди адресу за посиланням у листі.');notify('Перевір пошту','Надіслано інструкцію підтвердження, якщо реєстрація можлива.');}
      });
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
      $('khEditCallsign').value=p.callsign || '';
      $('khEditAddress').value=addressLabel(p.display_as);
      $('khEditBio').value=p.bio || '';
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
    form?.addEventListener('submit',event=>{
      event.preventDefault();
      if(!currentUser||!currentProfile){notify('Профіль ще завантажується','Спробуй трохи пізніше.',true);return;}
      withButton(form,async()=>{
        const callsign=currentProfile.role==='founder'?'ГАРТ':$('khEditCallsign').value.trim();
        if(callsign.toLocaleLowerCase('uk-UA')==='гарт' && currentProfile.role!=='founder')throw new Error('Позивний ГАРТ зарезервовано за засновником.');
        const updates={callsign,display_as:addressDb($('khEditAddress').value),listed:$('khEditPublic').checked,bio:readOptional('khEditBio')||null};
        if((updates.bio||'').length>500)throw new Error('Опис «Про себе» не може перевищувати 500 символів.');
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
  if(page==='members'){
    const list=$('khPublicMembersList'),search=$('khMemberSearch'),counter=$('khDirectoryCount'),empty=$('khMembersEmpty');
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
      sub.append(no,rank,badge);details.append(name,sub);
      li.append(avatar,details);
      if(p.role==='founder')li.classList.add('kh-founder-row');
      const go=document.createElement('a');go.href=(p.role==='founder'&&Number(p.member_no)===1)?link('founder.html'):link('member.html?no='+encodeURIComponent(p.member_no));
      go.className='kh-directory-profile-link';go.textContent='Картка ↗';go.setAttribute('aria-label','Відкрити картку '+(p.callsign||'учасника'));li.append(go);
      return li;
    }
    function render(){
      const q=search.value.trim().toLocaleLowerCase('uk-UA');
      const subset=entries.filter(p=>[p.callsign||'',p.rank||'',addressLabel(p.display_as),String(p.member_no)].join(' ').toLocaleLowerCase('uk-UA').includes(q));
      list.replaceChildren(...subset.map(row));
      counter.textContent=subset.length+' публічних профілів';empty.hidden=subset.length!==0;
    }
    search?.addEventListener('input',render);
    (async()=>{try{entries=(await publicProfiles()).filter(p=>p.callsign);render();}
      catch(e){counter.textContent='Недоступно';notify('Не вдалося завантажити учасників',sanitizeError(e),true);}})();
  }

  if(page==='member'){
    const loading=$('khMemberDetailLoading'),panel=$('khMemberDetail');
    (async()=>{
      try{
        if(!client)throw new Error('Сервіс публічних профілів наразі недоступний.');
        const n=Number(new URLSearchParams(location.search).get('no'));
        if(!Number.isSafeInteger(n)||n<1||n>999999999)throw new Error('Невірний номер учасника.');
        if(n===1){location.replace(link('founder.html'));return;}
        const {data,error}=await client.from('khar_profiles')
          .select('member_no,callsign,display_as,rank,role,bio')
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
      }catch(err){loading.textContent=sanitizeError(err);notify('Не вдалося відкрити картку',sanitizeError(err),true);}
    })();
  }

  if(page==='founder'){
    (async()=>{
      if(!client)return;
      try{
        const {data,error}=await client.from('khar_profiles').select('bio')
          .eq('member_no',1).eq('role','founder').eq('listed',true).maybeSingle();
        if(error)throw error;
        if(data?.bio){$('khFounderBio').textContent=data.bio;$('khFounderAbout').hidden=false;}
      }catch(e){console.warn('Founder biography unavailable');}
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
