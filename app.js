const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PHOTOS_BUCKET = 'photos';

if (!SUPABASE_URL || SUPABASE_URL.includes('xxxx')) {
  document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif;color:#db2777">'
    + 'Configure d\'abord config.js avec ton URL et ta clé Supabase (voir config.example.js).</p>';
  throw new Error('Supabase config missing');
}

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let state = {};       // letter -> { ideas: [{ id, text, checked, photos: [{id, path}] }] }
let nextIdeaId = null;
let currentLetter = null;
let photoContext = null; // { letter, idx }

function photoUrl(path) {
  return supabaseClient.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

function findIdeaById(id) {
  for (const l of ALPHABET) {
    const idx = state[l].ideas.findIndex(i => i.id === id);
    if (idx !== -1) return { letter: l, idx, idea: state[l].ideas[idx] };
  }
  return null;
}

async function loadAll() {
  const [{ data: ideas, error: e1 }, { data: photos, error: e2 }, { data: appState, error: e3 }] = await Promise.all([
    supabaseClient.from('ideas').select('*').order('created_at'),
    supabaseClient.from('photos').select('*').order('created_at'),
    supabaseClient.from('app_state').select('*').eq('id', 1).single(),
  ]);
  if (e1 || e2 || e3) {
    console.error(e1 || e2 || e3);
    alert('Erreur de connexion à la base de données. Vérifie config.js et ta connexion internet.');
    return;
  }

  state = {};
  ALPHABET.forEach(l => state[l] = { ideas: [] });
  const ideaById = {};
  ideas.forEach(row => {
    const idea = { id: row.id, text: row.text, checked: row.checked, photos: [] };
    ideaById[row.id] = idea;
    state[row.letter].ideas.push(idea);
  });
  photos.forEach(row => {
    const idea = ideaById[row.idea_id];
    if (idea) idea.photos.push({ id: row.id, path: row.path });
  });
  nextIdeaId = appState?.next_idea_id || null;
}

// ── DOM refs ──
const grid = document.getElementById('alphabet-grid');
const panel = document.getElementById('panel');
const overlay = document.getElementById('overlay');
const panelLetterEl = document.getElementById('panel-letter');
const ideasList = document.getElementById('ideas-list');
const newIdeaInput = document.getElementById('new-idea-input');
const addIdeaBtn = document.getElementById('add-idea-btn');
const closeBtn = document.getElementById('close-panel');
const nextCard = document.getElementById('next-card');
const pickerBackdrop = document.getElementById('picker-backdrop');
const pickerBody = document.getElementById('picker-body');
const closePicker = document.getElementById('close-picker');
const photoBackdrop = document.getElementById('photo-backdrop');
const photoGrid = document.getElementById('photo-grid');
const photoModalTitle = document.getElementById('photo-modal-title');
const photoInput = document.getElementById('photo-input');
const closePhotoBtn = document.getElementById('close-photo');

function createCard(letter) {
  const card = document.createElement('div');
  card.className = 'letter-card';
  card.id = `card-${letter}`;
  card.dataset.letter = letter;

  const letterEl = document.createElement('div');
  letterEl.className = 'letter';
  letterEl.textContent = letter;

  const countEl = document.createElement('div');
  countEl.className = 'count';

  const badge = document.createElement('span');
  badge.className = 'done-badge';
  badge.textContent = '✓';
  badge.style.display = 'none';

  card.appendChild(badge);
  card.appendChild(letterEl);
  card.appendChild(countEl);

  card.addEventListener('click', () => openPanel(letter));
  grid.appendChild(card);
}

function updateCard(letter) {
  const card = document.getElementById(`card-${letter}`);
  const data = state[letter];
  const total = data.ideas.length;
  const checked = data.ideas.filter(i => i.checked).length;
  const done = checked >= 1;

  card.querySelector('.count').textContent = total === 0 ? '0' : `${checked}/${total}`;
  card.classList.toggle('done', done);
  card.querySelector('.done-badge').style.display = done ? 'inline' : 'none';
  card.classList.toggle('active', currentLetter === letter);
}

function updateAllCards() {
  ALPHABET.forEach(updateCard);
}

function openPanel(letter) {
  if (currentLetter) {
    document.getElementById(`card-${currentLetter}`)?.classList.remove('active');
  }
  currentLetter = letter;
  document.getElementById(`card-${letter}`).classList.add('active');

  panelLetterEl.textContent = letter;
  renderIdeas();

  panel.classList.add('open');
  overlay.classList.add('visible');
  newIdeaInput.value = '';
  newIdeaInput.focus();
}

function closePanel() {
  panel.classList.remove('open');
  overlay.classList.remove('visible');
  if (currentLetter) {
    document.getElementById(`card-${currentLetter}`)?.classList.remove('active');
    currentLetter = null;
  }
}

function resizeImage(file, maxSize = 900) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round(height * maxSize / width); width = maxSize; }
          else { width = Math.round(width * maxSize / height); height = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.78);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function openPhotoViewer(letter, idx) {
  photoContext = { letter, idx };
  photoModalTitle.textContent = state[letter].ideas[idx].text;
  renderPhotoGrid();
  photoBackdrop.classList.add('open');
}

function renderPhotoGrid() {
  const { letter, idx } = photoContext;
  const photos = state[letter].ideas[idx].photos;
  photoGrid.innerHTML = '';

  if (photos.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'photo-empty';
    msg.textContent = 'Aucune photo — ajoutes-en une !';
    photoGrid.appendChild(msg);
    return;
  }

  photos.forEach(photo => {
    const url = photoUrl(photo.path);
    const wrapper = document.createElement('div');
    wrapper.className = 'photo-thumb';

    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    img.addEventListener('click', () => window.open(url, '_blank'));

    const del = document.createElement('button');
    del.className = 'photo-del';
    del.textContent = '✕';
    del.addEventListener('click', async e => {
      e.stopPropagation();
      await supabaseClient.storage.from(PHOTOS_BUCKET).remove([photo.path]);
      await supabaseClient.from('photos').delete().eq('id', photo.id);
      const idea = state[letter].ideas[idx];
      idea.photos = idea.photos.filter(p => p.id !== photo.id);
      renderPhotoGrid();
      renderIdeas();
    });

    wrapper.appendChild(img);
    wrapper.appendChild(del);
    photoGrid.appendChild(wrapper);
  });
}

photoInput.addEventListener('change', async e => {
  if (!photoContext) return;
  const { letter, idx } = photoContext;
  const idea = state[letter].ideas[idx];
  const files = Array.from(e.target.files);
  if (!files.length) return;

  for (const file of files) {
    const blob = await resizeImage(file);
    const path = `${idea.id}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabaseClient.storage.from(PHOTOS_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
    if (upErr) { console.error(upErr); continue; }
    const { data: row, error: insErr } = await supabaseClient.from('photos').insert({ idea_id: idea.id, path }).select().single();
    if (insErr) { console.error(insErr); continue; }
    idea.photos.push({ id: row.id, path: row.path });
  }
  renderPhotoGrid();
  renderIdeas();
  e.target.value = '';
});

closePhotoBtn.addEventListener('click', () => photoBackdrop.classList.remove('open'));
photoBackdrop.addEventListener('click', e => { if (e.target === photoBackdrop) photoBackdrop.classList.remove('open'); });

function openPicker() {
  pickerBody.innerHTML = '';
  const groups = ALPHABET.map(l => ({
    letter: l,
    unchecked: state[l].ideas.filter(i => !i.checked),
  })).filter(g => g.unchecked.length > 0);

  if (groups.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'picker-empty';
    msg.textContent = 'Toutes les idées sont cochées !';
    pickerBody.appendChild(msg);
  } else {
    groups.forEach(({ letter, unchecked }) => {
      const groupEl = document.createElement('div');

      const title = document.createElement('div');
      title.className = 'picker-group-title';
      title.textContent = letter;
      groupEl.appendChild(title);

      unchecked.forEach(idea => {
        const item = document.createElement('div');
        item.className = 'picker-item';

        const badge = document.createElement('span');
        badge.className = 'picker-letter-badge';
        badge.textContent = letter;

        const label = document.createElement('span');
        label.textContent = idea.text;

        item.appendChild(badge);
        item.appendChild(label);
        item.addEventListener('click', async () => {
          nextIdeaId = idea.id;
          await supabaseClient.from('app_state').update({ next_idea_id: nextIdeaId }).eq('id', 1);
          renderNextCard();
          pickerBackdrop.classList.remove('open');
        });
        groupEl.appendChild(item);
      });

      pickerBody.appendChild(groupEl);
    });
  }

  pickerBackdrop.classList.add('open');
}

function renderNextCard() {
  nextCard.innerHTML = '';
  const found = nextIdeaId ? findIdeaById(nextIdeaId) : null;

  if (!found) {
    nextCard.classList.remove('filled');
    const empty = document.createElement('span');
    empty.className = 'next-empty';
    empty.textContent = 'Appuie ici pour choisir une activité';
    nextCard.appendChild(empty);
    return;
  }

  nextCard.classList.add('filled');

  const badge = document.createElement('div');
  badge.className = 'next-badge';
  badge.textContent = found.letter;

  const info = document.createElement('div');
  info.className = 'next-info';

  const activity = document.createElement('div');
  activity.className = 'next-activity';
  activity.textContent = found.idea.text;
  info.appendChild(activity);

  const clearBtn = document.createElement('button');
  clearBtn.className = 'next-clear';
  clearBtn.textContent = '✕';
  clearBtn.title = 'Effacer';
  clearBtn.addEventListener('click', async e => {
    e.stopPropagation();
    nextIdeaId = null;
    await supabaseClient.from('app_state').update({ next_idea_id: null }).eq('id', 1);
    renderNextCard();
  });

  nextCard.appendChild(badge);
  nextCard.appendChild(info);
  nextCard.appendChild(clearBtn);
}

function renderIdeas() {
  ideasList.innerHTML = '';
  const ideas = state[currentLetter].ideas;

  if (ideas.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'empty-msg';
    msg.textContent = 'Aucune idée pour le moment. Ajoutes-en une !';
    ideasList.appendChild(msg);
    return;
  }

  ideas.forEach((idea, idx) => {
    const li = document.createElement('li');
    li.className = 'idea-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'idea-check';
    checkbox.checked = idea.checked;
    checkbox.addEventListener('change', async () => {
      idea.checked = checkbox.checked;
      textEl.classList.toggle('checked', checkbox.checked);
      updateCard(currentLetter);
      await supabaseClient.from('ideas').update({ checked: idea.checked }).eq('id', idea.id);
    });

    const textEl = document.createElement('span');
    textEl.className = 'idea-text' + (idea.checked ? ' checked' : '');
    textEl.textContent = idea.text;

    const photoCount = idea.photos.length;
    const camBtn = document.createElement('button');
    camBtn.className = 'idea-cam' + (photoCount > 0 ? ' has-photos' : '');
    camBtn.title = 'Photos';
    if (photoCount > 0) {
      camBtn.innerHTML = `📷 <span class="cam-count">${photoCount}</span>`;
    } else {
      camBtn.textContent = '📷';
    }
    camBtn.addEventListener('click', () => openPhotoViewer(currentLetter, idx));

    const delBtn = document.createElement('button');
    delBtn.className = 'idea-delete';
    delBtn.textContent = '✕';
    delBtn.title = 'Supprimer';
    delBtn.addEventListener('click', async () => {
      const paths = idea.photos.map(p => p.path);
      if (paths.length) await supabaseClient.storage.from(PHOTOS_BUCKET).remove(paths);
      await supabaseClient.from('ideas').delete().eq('id', idea.id);
      if (nextIdeaId === idea.id) {
        nextIdeaId = null;
        await supabaseClient.from('app_state').update({ next_idea_id: null }).eq('id', 1);
        renderNextCard();
      }
      state[currentLetter].ideas.splice(idx, 1);
      renderIdeas();
      updateCard(currentLetter);
    });

    li.appendChild(checkbox);
    li.appendChild(textEl);
    li.appendChild(camBtn);
    li.appendChild(delBtn);
    ideasList.appendChild(li);
  });
}

async function addIdea() {
  const text = newIdeaInput.value.trim();
  if (!text || !currentLetter) return;
  newIdeaInput.value = '';
  const { data, error } = await supabaseClient.from('ideas').insert({ letter: currentLetter, text }).select().single();
  if (error) { console.error(error); return; }
  state[currentLetter].ideas.push({ id: data.id, text: data.text, checked: data.checked, photos: [] });
  renderIdeas();
  updateCard(currentLetter);
  newIdeaInput.focus();
}

// ── Events ──
addIdeaBtn.addEventListener('click', addIdea);
newIdeaInput.addEventListener('keydown', e => { if (e.key === 'Enter') addIdea(); });

nextCard.addEventListener('click', openPicker);
nextCard.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') openPicker(); });
closePicker.addEventListener('click', () => pickerBackdrop.classList.remove('open'));
pickerBackdrop.addEventListener('click', e => { if (e.target === pickerBackdrop) pickerBackdrop.classList.remove('open'); });

closeBtn.addEventListener('click', closePanel);
overlay.addEventListener('click', closePanel);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    photoBackdrop.classList.remove('open');
    pickerBackdrop.classList.remove('open');
    closePanel();
  }
});

// ── Realtime sync across devices ──
let reloadTimer = null;
function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    await loadAll();
    updateAllCards();
    renderNextCard();
    if (currentLetter) renderIdeas();
  }, 500);
}

supabaseClient
  .channel('changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas' }, scheduleReload)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, scheduleReload)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, scheduleReload)
  .subscribe();

// ── Init ──
ALPHABET.forEach(createCard);
(async () => {
  await loadAll();
  updateAllCards();
  renderNextCard();
})();
