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

  // Відзнаки завжди завантажуються з БД; клієнт ніколи не надає їх напряму.
  function renderAwardChips(badges, host){
    if(!host)return;
    host.replaceChildren();
    if(!badges.length){const blank=document.createElement('span');blank.className='kh-awards-pending';
      blank.textContent='Відзнак поки немає. Усе починається з вчинків.';host.append(blank);return;}
    for(const badge of badges){
      const item=document.createElement('span');
      item.className='kh-award-chip kh-'+(badge.kind==='community'?'community':badge.kind==='manual'?'manual':'rank')+(badge.code==='team_member'?' kh-team-member':'');
      item.setAttribute('role','listitem');item.title=badge.description||badge.title;
      const icon=document.createElement('span');icon.className='kh-award-glyph';icon.textContent=badge.symbol||'✦';
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
      for(const b of catalog||[]){const opt=document.createElement('option');opt.value=b.code;opt.textContent=(b.symbol||'✦')+' '+b.title;opt.title=b.description;codes.append(opt);}
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
