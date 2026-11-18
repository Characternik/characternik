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
      .select('id,member_no,callsign,display_as,rank,role,listed')
      .eq('id',user.id).maybeSingle();
    if(error)throw error;
    if(!data)throw new Error('Профіль не знайдено в базі. Перевір реєстрацію або SQL-налаштування.');
    return data;
  };
  async function publicProfiles(){
    if(!client)throw new Error('Не вдалося підключитися до списку учасників.');
    const {data,error}=await client.from('khar_profiles')
      .select('member_no,callsign,display_as,rank,role')
      .eq('listed',true).order('member_no',{ascending:true}).limit(250);
    if(error)throw error;
    return data || [];
  }

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
          options:{emailRedirectTo:link('login.html'), data:{callsign, display_as:chosen}}
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
      $('khAccountTitle').textContent=p.callsign || 'Обери позивний';
      $('khAccountNumber').textContent='№'+formatNo(p.member_no);
      $('khAccountRank').textContent=(p.role==='founder'?'Засновник':'Ранг: '+p.rank)+' · '+addressLabel(p.display_as);
      $('khEditCallsign').value=p.callsign || '';
      $('khEditAddress').value=addressLabel(p.display_as);
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
      }catch(err){loading.hidden=true;displayError(err,'Не вдалося відкрити кабінет');}
    })();
    form?.addEventListener('submit',event=>{
      event.preventDefault();
      if(!currentUser||!currentProfile){notify('Профіль ще завантажується','Спробуй трохи пізніше.',true);return;}
      withButton(form,async()=>{
        const callsign=currentProfile.role==='founder'?'ГАРТ':$('khEditCallsign').value.trim();
        if(callsign.toLocaleLowerCase('uk-UA')==='гарт' && currentProfile.role!=='founder')throw new Error('Позивний ГАРТ зарезервовано за засновником.');
        const updates={callsign,display_as:addressDb($('khEditAddress').value),listed:$('khEditPublic').checked};
        const {data,error}=await client.from('khar_profiles')
          .update(updates).eq('id',currentUser.id)
          .select('id,member_no,callsign,display_as,rank,role,listed').single();
        if(error)throw error;
        if(!data || data.callsign!==updates.callsign || data.display_as!==updates.display_as || Boolean(data.listed)!==updates.listed)
          throw new Error('База не підтвердила збереження усіх змін.');
        present(data);setMessage('✓ Зміни збережено у базі даних.');
        notify('Дані збережено!','Позивний, звертання та видимість профілю оновлено.');
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
      const avatar=document.createElement('div');avatar.className='kh-member-avatar';
      avatar.textContent=p.role==='founder'?'✦':Array.from(p.callsign||'УЧ').slice(0,2).join('').toUpperCase();
      const details=document.createElement('div');details.className='kh-member-profile';
      const name=document.createElement('strong');name.className='kh-member-name';name.textContent=p.callsign||'Без позивного';
      const sub=document.createElement('div');sub.className='kh-member-sub';
      const no=document.createElement('span');no.className='kh-member-id';no.textContent='№'+formatNo(p.member_no);
      const rank=document.createElement('span');rank.className='kh-rank';rank.textContent=p.rank||'Шукач';
      const badge=document.createElement('span');badge.className='kh-identity-badge '+(p.display_as==='posestra'?'kh-identity-sister':'kh-identity-brother');
      badge.textContent=(p.display_as==='posestra'?'✿ ':p.display_as==='pobratym'?'✦ ':'◇ ')+addressLabel(p.display_as);
      sub.append(no,rank,badge);details.append(name,sub);
      li.append(avatar,details);
      if(p.role==='founder'){
        li.classList.add('kh-founder-row');
        const go=document.createElement('a');go.href='founder.html';go.className='kh-founder-link';go.textContent='Особиста картка ↗';go.style.marginLeft='auto';li.append(go);
      }
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
