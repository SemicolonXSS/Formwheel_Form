(() => {
  'use strict';

  // ---------- Firebase (shared FormWheel project) ----------
  const firebaseConfig = {
    apiKey: "AIzaSyBreTSe1m0-xlbF4aupnU5isRZCihR25IE",
    authDomain: "formwheel.firebaseapp.com",
    databaseURL: "https://formwheel-default-rtdb.firebaseio.com/",
    projectId: "formwheel",
    storageBucket: "formwheel.firebasestorage.app",
    messagingSenderId: "431583088241",
    appId: "1:431583088241:web:74e0e34ea1e3e1170c55d0"
  };
  let db = null;
  let fbReady = false;
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    fbReady = true;
  } catch (e) {
    fbReady = false;
  }

  async function storeGet(key) {
    if (!fbReady) return null;
    try {
      const snap = await db.ref('data/' + key).once('value');
      return snap.exists() ? snap.val() : null;
    } catch (e) {
      return null;
    }
  }
  async function storeSet(key, val) {
    if (!fbReady) return false;
    try {
      await db.ref('data/' + key).set(val);
      return true;
    } catch (e) {
      return false;
    }
  }
  async function storeList(prefix) {
    if (!fbReady) return [];
    try {
      const snap = await db.ref('data')
        .orderByKey()
        .startAt(prefix)
        .endAt(prefix + '\uf8ff')
        .once('value');
      const val = snap.val() || {};
      return Object.keys(val);
    } catch (e) {
      return [];
    }
  }
  function uid(len) {
    return Math.random().toString(36).slice(2, 2 + len);
  }

  const $ = (selector) => document.querySelector(selector);
  const questionsEl = $('#questions');
  const titleEl = $('#title');
  const descEl = $('#description');
  const toastEl = $('#toast');
  const linkModal = $('#linkModal');
  const generatedLinkEl = $('#generatedLink');
  const linkTitleEl = $('#linkTitle');
  const linkDescEl = $('#linkDesc');
  const responsesModal = $('#responsesModal');
  const responsesListEl = $('#responsesList');
  const responsesLookupEl = $('#responsesLookup');
  const WHEEL_BASE_URL = 'https://semicolonxss.github.io/Formwheel_Wheel/';
  // Links are built from wherever this page is actually running (local file,
  // staging, or the real production domain) instead of a hardcoded URL, so a
  // generated link always points at code that matches it — no more mismatch
  // between "the link format the publish button just made" and "whatever
  // version of this file happens to be deployed at a fixed URL".
  function getBaseUrl() {
    return window.location.href.split('#')[0];
  }

  let questions = [
    { text: '', type: 'choice', choices: ['선택지 1', '선택지 2'] }
  ];

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function makeButton(text, className = 'iconbtn') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    return button;
  }

  function renderQuestions() {
    questionsEl.replaceChildren();

    if (questions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      const strong = document.createElement('strong');
      strong.textContent = '아직 질문이 없어요';
      const span = document.createElement('span');
      span.textContent = '“＋ 질문 추가”를 눌러 첫 질문을 만들어보세요.';
      empty.append(strong, span);
      questionsEl.appendChild(empty);
      return;
    }

    questions.forEach((q, index) => {
      const box = document.createElement('div');
      box.className = 'question';

      const head = document.createElement('div');
      head.className = 'qhead';

      const drag = document.createElement('span');
      drag.className = 'drag';
      drag.textContent = '⋮⋮';

      const num = document.createElement('span');
      num.className = 'qnum';
      num.textContent = String(index + 1);

      const actions = document.createElement('div');
      actions.className = 'qactions';

      const up = makeButton('↑');
      up.title = '위로';
      up.disabled = index === 0;
      up.addEventListener('click', () => moveQuestion(index, -1));

      const down = makeButton('↓');
      down.title = '아래로';
      down.disabled = index === questions.length - 1;
      down.addEventListener('click', () => moveQuestion(index, 1));

      const del = makeButton('삭제');
      del.title = '질문 삭제';
      del.addEventListener('click', () => {
        questions.splice(index, 1);
        renderQuestions();
        updatePreview();
      });

      const wheel = makeButton('🎡 돌림판 생성', 'btn');
      wheel.title = '이 질문으로 돌림판 만들기';
      wheel.addEventListener('click', () => generateWheelLink(index));

      actions.append(up, down, wheel, del);
      head.append(drag, num, actions);

      const typeRow = document.createElement('div');
      typeRow.className = 'type-row';

      const qInput = document.createElement('input');
      qInput.type = 'text';
      qInput.maxLength = 300;
      qInput.placeholder = '질문을 입력하세요';
      qInput.value = q.text || '';
      qInput.addEventListener('input', (event) => {
        questions[index].text = event.target.value;
        updatePreview();
      });

      const select = document.createElement('select');
      [
        ['choice', '객관식'],
        ['checkbox', '체크박스'],
        ['text', '주관식']
      ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.selected = q.type === value;
        select.appendChild(option);
      });

      select.addEventListener('change', (event) => {
        questions[index].type = event.target.value;
        if (event.target.value === 'text') {
          questions[index].choices = [];
        } else if (!Array.isArray(questions[index].choices) || questions[index].choices.length === 0) {
          questions[index].choices = ['선택지 1', '선택지 2'];
        }
        renderQuestions();
        updatePreview();
      });

      typeRow.append(qInput, select);
      box.append(head, typeRow);

      if (q.type !== 'text') {
        const choices = document.createElement('div');
        choices.className = 'choices';

        (q.choices || []).forEach((choice, cIndex) => {
          const row = document.createElement('div');
          row.className = 'choice-row';

          const marker = document.createElement('span');
          marker.className = q.type === 'choice' ? 'choice-dot' : 'choice-check';

          const input = document.createElement('input');
          input.type = 'text';
          input.maxLength = 200;
          input.value = choice || '';
          input.addEventListener('input', (event) => {
            questions[index].choices[cIndex] = event.target.value;
            updatePreview();
          });

          const remove = makeButton('×');
          remove.title = '선택지 삭제';
          remove.addEventListener('click', () => {
            if (questions[index].choices.length <= 1) {
              showToast('선택지는 최소 1개가 필요해요.');
              return;
            }
            questions[index].choices.splice(cIndex, 1);
            renderQuestions();
            updatePreview();
          });

          row.append(marker, input, remove);
          choices.appendChild(row);
        });

        const addChoice = document.createElement('button');
        addChoice.type = 'button';
        addChoice.className = 'add-choice';
        addChoice.textContent = '＋ 선택지 추가';
        addChoice.addEventListener('click', () => {
          questions[index].choices.push(`선택지 ${questions[index].choices.length + 1}`);
          renderQuestions();
          updatePreview();
        });

        box.append(choices, addChoice);
      }

      questionsEl.appendChild(box);
    });
  }

  function moveQuestion(index, direction) {
    const next = index + direction;
    if (next < 0 || next >= questions.length) return;

    [questions[index], questions[next]] = [questions[next], questions[index]];
    renderQuestions();
    updatePreview();
  }

  function updatePreview() {
    const box = $('#previewBox');
    box.replaceChildren();

    const title = document.createElement('div');
    title.className = 'preview-title';
    title.textContent = titleEl.value.trim() || '제목 없는 Form';

    const desc = document.createElement('div');
    desc.className = 'preview-desc';
    desc.textContent = descEl.value.trim() || '설명 없음';

    box.append(title, desc);

    questions.forEach((q, index) => {
      const item = document.createElement('div');
      item.className = 'preview-q';

      const question = document.createElement('b');
      question.textContent = `${index + 1}. ${q.text.trim() || '질문을 입력해주세요.'}`;
      item.appendChild(question);

      if (q.type === 'text') {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '답변을 입력하세요';
        input.disabled = true;
        item.appendChild(input);
      } else {
        (q.choices || []).forEach(choice => {
          const option = document.createElement('div');
          option.className = 'preview-option';

          const marker = document.createElement('span');
          marker.className = q.type === 'choice' ? 'choice-dot' : 'choice-check';

          const text = document.createElement('span');
          text.textContent = choice || '선택지';

          option.append(marker, text);
          item.appendChild(option);
        });
      }

      box.appendChild(item);
    });
  }

  function getFormData() {
    return {
      title: titleEl.value.trim(),
      description: descEl.value.trim(),
      questions: questions.map(q => ({
        text: String(q.text || ''),
        type: q.type === 'text' ? 'text' : (q.type === 'checkbox' ? 'checkbox' : 'choice'),
        choices: Array.isArray(q.choices) ? q.choices.map(v => String(v || '')) : [],
        wheelAnswers: Array.isArray(q.wheelAnswers) ? q.wheelAnswers.map(v => String(v || '')) : []
      })),
      updatedAt: new Date().toISOString()
    };
  }

  function save(showMessage = true) {
    try {
      localStorage.setItem('formwheel_form', JSON.stringify(getFormData()));
      if (showMessage) showToast('Form이 저장됐어요!');
      return true;
    } catch (error) {
      showToast('저장할 수 없어요. 브라우저 저장공간을 확인해주세요.');
      return false;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem('formwheel_form');
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;

      titleEl.value = typeof data.title === 'string' ? data.title : '';
      descEl.value = typeof data.description === 'string' ? data.description : '';

      if (Array.isArray(data.questions)) {
        questions = data.questions.map(q => ({
          text: typeof q.text === 'string' ? q.text : '',
          type: q.type === 'text' ? 'text' : (q.type === 'checkbox' ? 'checkbox' : 'choice'),
          choices: Array.isArray(q.choices) ? q.choices.map(v => String(v || '')) : [],
          wheelAnswers: Array.isArray(q.wheelAnswers) ? q.wheelAnswers.map(v => String(v || '')) : []
        }));

        if (!questions.length) {
          questions = [{ text: '', type: 'choice', choices: ['선택지 1', '선택지 2'] }];
        }
      }
    } catch (error) {
      localStorage.removeItem('formwheel_form');
    }
  }

  function openShareModal(title, desc, link) {
    linkTitleEl.textContent = title;
    linkDescEl.textContent = desc;
    generatedLinkEl.value = link;
    $('#openLinkBtn').href = link;
    linkModal.classList.add('show');
    linkModal.setAttribute('aria-hidden', 'false');
    generatedLinkEl.focus();
    generatedLinkEl.select();
  }

  function generateLink() {
    save(false);

    const payload = getFormData();
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const link = `${getBaseUrl()}#form=${encoded}`;

    openShareModal(
      '공유 링크가 생성됐어요 🔗',
      '이 링크는 지금 작성 중인 내용을 이어서 편집할 수 있게 해줘요(편집용). 응답을 실제로 모으려면 "설문 게시"를 사용하세요.',
      link
    );
  }

  async function publishForm() {
    const title = titleEl.value.trim();
    if (!title) {
      showToast('설문 제목을 입력해주세요.');
      titleEl.focus();
      return;
    }

    const validQuestions = questions.filter(q => q.text.trim());
    if (!validQuestions.length) {
      showToast('질문을 1개 이상 입력해주세요.');
      return;
    }

    for (const q of validQuestions) {
      if (q.type !== 'text') {
        const filled = (q.choices || []).map(c => c.trim()).filter(Boolean);
        if (filled.length < 2) {
          showToast('모든 객관식/체크박스 질문에는 선택지가 2개 이상 필요해요.');
          return;
        }
      }
    }

    save(false);

    const publishBtn = $('#publishBtn');
    const originalText = publishBtn.textContent;
    publishBtn.disabled = true;
    publishBtn.textContent = '게시하는 중...';

    const payload = getFormData();
    const formId = uid(8);
    const ok = await storeSet('frm:' + formId + ':meta', payload);

    publishBtn.disabled = false;
    publishBtn.textContent = originalText;

    if (!ok) {
      showToast('게시에 실패했어요. 인터넷 연결을 확인하고 다시 시도해주세요.');
      return;
    }

    try {
      localStorage.setItem('formwheel_last_published_id', formId);
    } catch (_) { /* ignore storage errors */ }

    const link = `${getBaseUrl()}#respond=${formId}`;

    openShareModal(
      '설문이 게시됐어요 🎉',
      '아래 링크를 공유하면 누구나 어떤 기기에서든 바로 응답할 수 있어요. 응답은 서버에 모여서 "응답 보기"에서 실시간으로 확인할 수 있어요.',
      link
    );
  }

  function extractFormId(value) {
    if (!value) return '';
    const idx = value.indexOf('#respond=');
    if (idx !== -1) return value.slice(idx + 9).trim();
    return value.trim();
  }

  function showEmptyResponses(strongText, spanText) {
    responsesListEl.replaceChildren();
    const empty = document.createElement('div');
    empty.className = 'empty';
    const strong = document.createElement('strong');
    strong.textContent = strongText;
    const span = document.createElement('span');
    span.textContent = spanText;
    empty.append(strong, span);
    responsesListEl.appendChild(empty);
  }

  async function loadResponses(formId) {
    if (!formId) {
      showEmptyResponses('아직 게시된 설문이 없어요', '먼저 "설문 게시" 버튼으로 설문을 게시하거나, 위에 설문 링크를 붙여넣어 조회해보세요.');
      return;
    }

    responsesListEl.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 'empty';
    loading.textContent = '불러오는 중...';
    responsesListEl.appendChild(loading);

    const formSnapshot = await storeGet('frm:' + formId + ':meta');
    if (!formSnapshot) {
      showEmptyResponses('설문을 찾을 수 없어요', '링크나 코드를 다시 확인해주세요.');
      return;
    }

    const prefix='frm:'+formId+':resp:',list=[];let cursor=null;
    try{
      while(true){
        let query=db.ref('data').orderByKey().startAt(cursor||prefix).endAt(prefix+'\uf8ff').limitToFirst(51);
        const snapshot=await query.once('value'),page=snapshot.val()||{},keys=Object.keys(page).sort().filter(k=>k!==cursor);
        for(const key of keys)if(page[key])list.push(page[key]);
        if(keys.length<(cursor?50:51))break;cursor=keys[keys.length-1];
      }
    }catch{showEmptyResponses('응답을 불러오지 못했습니다','연결과 조회 권한을 확인해주세요.');return;}
    list.sort((a,b)=>new Date(a.submittedAt||0)-new Date(b.submittedAt||0));

    responsesListEl.replaceChildren();

    if (!list.length) {
      showEmptyResponses('아직 제출된 응답이 없어요', '설문 링크를 공유하고 응답을 받아보세요.');
      return;
    }

    const count = document.createElement('div');
    count.style.fontWeight = '800';
    count.style.marginBottom = '10px';
    count.textContent = `총 ${list.length}개의 응답 — "${formSnapshot.title || '제목 없는 Form'}"`;
    responsesListEl.appendChild(count);

    list.forEach((response, rIndex) => {
      const box = document.createElement('div');
      box.className = 'question';

      const head = document.createElement('div');
      head.style.fontWeight = '800';
      head.style.marginBottom = '10px';
      head.style.color = 'var(--muted)';
      head.style.fontSize = '12px';
      const when = response.submittedAt ? new Date(response.submittedAt).toLocaleString('ko-KR') : '';
      head.textContent = `응답 #${rIndex + 1}${when ? ' · ' + when : ''}`;
      box.appendChild(head);

      (formSnapshot.questions || []).forEach((q, qIndex) => {
        const qBox = document.createElement('div');
        qBox.className = 'preview-q';

        const label = document.createElement('b');
        label.textContent = `${qIndex + 1}. ${q.text || '질문'}`;
        qBox.appendChild(label);

        const answerVal = response.answers ? response.answers[qIndex] : undefined;
        const answerText = document.createElement('div');
        answerText.style.color = '#444957';
        answerText.style.fontSize = '14px';
        answerText.style.marginTop = '6px';

        if (Array.isArray(answerVal)) {
          answerText.textContent = answerVal.length ? answerVal.join(', ') : '(응답 없음)';
        } else if (answerVal) {
          answerText.textContent = answerVal;
        } else {
          answerText.textContent = '(응답 없음)';
        }

        qBox.appendChild(answerText);
        box.appendChild(qBox);
      });

      responsesListEl.appendChild(box);
    });
  }

  function showResponses() {
    let lastId = '';
    try {
      lastId = localStorage.getItem('formwheel_last_published_id') || '';
    } catch (_) { /* ignore */ }

    responsesLookupEl.value = lastId ? (getBaseUrl() + '#respond=' + lastId) : '';

    responsesModal.classList.add('show');
    responsesModal.setAttribute('aria-hidden', 'false');
    loadResponses(lastId);
  }

  function closeResponsesModal() {
    responsesModal.classList.remove('show');
    responsesModal.setAttribute('aria-hidden', 'true');
  }

  function generateWheelLink(index) {
    const q = questions[index];
    if (!q) return;

    let choices;

    if (q.type === 'text') {
      const existing = Array.isArray(q.wheelAnswers) ? q.wheelAnswers.join('\n') : '';
      const input = window.prompt(
        '이 질문에 대해 나올 수 있는 답변들을 한 줄에 하나씩 입력하세요.\n(쉼표로 구분해도 됩니다)',
        existing
      );
      if (input === null) return;

      choices = input
        .split(/\r?\n|,/)
        .map(c => c.trim())
        .filter(Boolean);

      if (choices.length < 2) {
        showToast('돌림판을 만들려면 답변이 2개 이상 필요해요.');
        return;
      }

      q.wheelAnswers = choices;
    } else {
      choices = (q.choices || []).map(c => String(c || '').trim()).filter(Boolean);
      if (choices.length < 2) {
        showToast('돌림판을 만들려면 선택지가 2개 이상 필요해요.');
        return;
      }
    }

    const payload = {
      title: q.text.trim() || `질문 ${index + 1}`,
      choices
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const link = `${WHEEL_BASE_URL}#wheel=${encoded}`;

    openShareModal(
      '돌림판 링크가 생성됐어요 🎡',
      `"${payload.title}" 질문의 답변으로 만든 돌림판 링크예요. 아래 링크를 복사해서 공유하세요.`,
      link
    );
  }

  async function copyLink() {
    const value = generatedLinkEl.value;
    try {
      await navigator.clipboard.writeText(value);
      showToast('링크가 복사됐어요!');
    } catch (_) {
      generatedLinkEl.focus();
      generatedLinkEl.select();
      document.execCommand('copy');
      showToast('링크가 복사됐어요!');
    }
  }

  function closeModal() {
    linkModal.classList.remove('show');
    linkModal.setAttribute('aria-hidden', 'true');
  }

  function renderRespondPage(data, formId) {
    const card = $('#respondCard');
    const answers = {};

    function renderForm() {
      card.replaceChildren();

      const title = document.createElement('div');
      title.className = 'preview-title';
      title.style.fontSize = '26px';
      title.textContent = data.title || '제목 없는 Form';

      const desc = document.createElement('div');
      desc.className = 'preview-desc';
      desc.textContent = data.description || '';

      card.append(title, desc);

      if (!formId) {
        return;
      }

      (data.questions || []).forEach((q, idx) => {
        const qBox = document.createElement('div');
        qBox.className = 'preview-q';

        const label = document.createElement('b');
        label.textContent = `${idx + 1}. ${q.text || '질문'}`;
        qBox.appendChild(label);

        if (q.type === 'text') {
          const input = document.createElement('input');
          input.type = 'text';
          input.placeholder = '답변을 입력하세요';
          input.style.width = '100%';
          input.addEventListener('input', (e) => { answers[idx] = e.target.value; });
          qBox.appendChild(input);
        } else {
          const name = `respond-q${idx}`;
          (q.choices || []).forEach((choice) => {
            const optRow = document.createElement('label');
            optRow.className = 'preview-option';
            optRow.style.cursor = 'pointer';

            const input = document.createElement('input');
            input.type = q.type === 'checkbox' ? 'checkbox' : 'radio';
            input.name = name;
            input.value = choice;
            input.addEventListener('change', () => {
              if (q.type === 'checkbox') {
                if (!Array.isArray(answers[idx])) answers[idx] = [];
                answers[idx] = input.checked
                  ? [...answers[idx], choice]
                  : answers[idx].filter(v => v !== choice);
              } else {
                answers[idx] = choice;
              }
            });

            const span = document.createElement('span');
            span.textContent = choice;

            optRow.append(input, span);
            qBox.appendChild(optRow);
          });
        }

        card.appendChild(qBox);
      });

      const submitBtn = document.createElement('button');
      submitBtn.type = 'button';
      submitBtn.className = 'btn publish';
      submitBtn.style.marginTop = '18px';
      submitBtn.style.width = '100%';
      submitBtn.textContent = '제출';
      submitBtn.addEventListener('click', async () => {
        submitBtn.disabled = true;
        submitBtn.textContent = '제출 중...';

        const ok = await storeSet('frm:' + formId + ':resp:' + uid(10), {
          answers,
          submittedAt: new Date().toISOString()
        });

        if (!ok) {
          submitBtn.disabled = false;
          submitBtn.textContent = '제출';
          showToast('제출에 실패했어요. 인터넷 연결을 확인하고 다시 시도해주세요.');
          return;
        }

        card.replaceChildren();
        const thanks = document.createElement('div');
        thanks.className = 'preview-title';
        thanks.textContent = '응답이 제출됐어요 🎉';
        const note = document.createElement('div');
        note.className = 'preview-desc';
        note.textContent = '소중한 의견 감사합니다.';
        card.append(thanks, note);
      });

      card.appendChild(submitBtn);
    }

    renderForm();
  }

  async function loadRespondFromFirebase(formId) {
    document.querySelector('body > header.topbar').style.display = 'none';
    document.querySelector('body > main').style.display = 'none';

    const respondPage = $('#respondPage');
    respondPage.style.display = 'block';

    const card = $('#respondCard');
    card.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 'preview-desc';
    loading.textContent = '설문을 불러오는 중...';
    card.appendChild(loading);

    if (!formId) {
      renderRespondPage({ title: '설문을 찾을 수 없어요', description: '링크가 올바르지 않아요.', questions: [] }, null);
      return;
    }

    const data = await storeGet('frm:' + formId + ':meta');
    if (!data) {
      renderRespondPage({ title: '설문을 찾을 수 없어요', description: '링크가 잘못되었거나 설문이 삭제되었을 수 있어요.', questions: [] }, null);
      return;
    }

    renderRespondPage(data, formId);
  }

  function loadFromLink() {
    const hash = window.location.hash;
    if (!hash.startsWith('#form=')) return;

    try {
      const encoded = hash.slice(6);
      const data = JSON.parse(decodeURIComponent(escape(atob(encoded))));

      if (!data || typeof data !== 'object') return;

      titleEl.value = typeof data.title === 'string' ? data.title : '';
      descEl.value = typeof data.description === 'string' ? data.description : '';

      if (Array.isArray(data.questions)) {
        questions = data.questions.map(q => ({
          text: String(q.text || ''),
          type: q.type === 'text' ? 'text' : (q.type === 'checkbox' ? 'checkbox' : 'choice'),
          choices: Array.isArray(q.choices) ? q.choices.map(v => String(v || '')) : [],
          wheelAnswers: Array.isArray(q.wheelAnswers) ? q.wheelAnswers.map(v => String(v || '')) : []
        }));
      }

      localStorage.setItem('formwheel_form', JSON.stringify(getFormData()));
      showToast('공유된 Form을 불러왔어요!');
    } catch (_) {
      showToast('링크 데이터를 읽을 수 없어요.');
    }
  }

  $('#addQuestion').addEventListener('click', () => {
    questions.push({
      text: '',
      type: 'choice',
      choices: ['선택지 1', '선택지 2']
    });

    renderQuestions();
    updatePreview();

    requestAnimationFrame(() => {
      const last = questionsEl.lastElementChild;
      last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = last?.querySelector('input');
      input?.focus();
    });

    showToast('질문이 추가됐어요!');
  });

  $('#saveBtn').addEventListener('click', () => save(true));

  $('#previewBtn').addEventListener('click', () => {
    updatePreview();
    document.querySelector('.preview')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('미리보기를 업데이트했어요!');
  });

  $('#linkBtn').addEventListener('click', generateLink);
  $('#publishBtn').addEventListener('click', publishForm);
  $('#responsesBtn').addEventListener('click', showResponses);
  $('#lookupResponsesBtn').addEventListener('click', () => {
    const id = extractFormId(responsesLookupEl.value.trim());
    if (!id) {
      showToast('설문 링크 또는 코드를 입력해주세요.');
      return;
    }
    loadResponses(id);
  });
  $('#copyLinkBtn').addEventListener('click', copyLink);
  $('#closeLinkBtn').addEventListener('click', closeModal);
  $('#closeResponsesBtn').addEventListener('click', closeResponsesModal);

  linkModal.addEventListener('click', (event) => {
    if (event.target === linkModal) closeModal();
  });

  responsesModal.addEventListener('click', (event) => {
    if (event.target === responsesModal) closeResponsesModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      closeResponsesModal();
    }
  });

  titleEl.addEventListener('input', updatePreview);
  descEl.addEventListener('input', updatePreview);

  window.addEventListener('hashchange', () => {
    window.location.reload();
  });

  if (window.location.hash.startsWith('#respond=')) {
    const formId = window.location.hash.slice(9).trim();
    loadRespondFromFirebase(formId);
  } else {
    load();
    loadFromLink();
    renderQuestions();
    updatePreview();
  }
})();
