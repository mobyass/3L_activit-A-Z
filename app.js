const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const DEFAULT_IDEAS = {
  A: ['Aquarium', 'Atelier de cuisine', 'Astronomie (nuit étoilée)'],
  B: ['Balade en vélo', 'Bowling', 'Brunch en amoureux'],
  C: ['Cinéma en plein air', 'Cours de danse', 'Chalet à la montagne'],
  D: ['Dégustation de vins', 'Dessin ensemble', 'Dîner aux chandelles'],
  E: ['Escape game', 'Exposition d\'art', 'Escalade'],
  F: ['Festival de musique', 'Feu de camp', 'Forêt enchantée'],
  G: ['Grimpette en forêt', 'Gastronomie locale', 'Go-kart'],
  H: ['Hammam & spa', 'Hamac sous les étoiles', 'Hiking en montagne'],
  I: ['Île à explorer', 'Impro théâtre', 'Ice skating'],
  J: ['Jardinage ensemble', 'Jeux de société', 'Journée plage'],
  K: ['Karaoké', 'Kayak', 'Kart électrique'],
  L: ['Laser game', 'Lecture au parc', 'Lunapark'],
  M: ['Match de sport', 'Musée', 'Marché nocturne'],
  N: ['Nuit sous les étoiles', 'Nuit dans un hôtel insolite', 'Nature walk'],
  O: ['Opéra', 'Observation des oiseaux', 'Open mic comedy'],
  P: ['Pique-nique', 'Paint & sip', 'Poterie'],
  Q: ['Quiz en couple', 'Quartier méconnu à explorer', 'Quête urbaine'],
  R: ['Road trip surprise', 'Restaurant haut de gamme', 'Randonnée'],
  S: ['Spa', 'Surf', 'Soirée jeux vidéo en duo'],
  T: ['Théâtre', 'Trampolines', 'Tir à l\'arc'],
  U: ['Urban sketching', 'Ukulélé (cours à deux)', 'Ultramarathon spectateur'],
  V: ['Vignoble', 'Vélo électrique', 'Vide-greniers dépaysant'],
  W: ['Week-end surprise', 'Wakeboard', 'Workshop créatif'],
  X: ['Xylophone atelier', 'Xbox gaming café', 'Xmas market (marché de Noël)'],
  Y: ['Yoga du matin', 'Yourte romantique', 'Yoga aerial'],
  Z: ['Zoo', 'Zen retraite', 'Ziplining'],
};

const STORAGE_KEY = 'date-alphabet-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  const state = {};
  for (const l of ALPHABET) {
    state[l] = {
      ideas: DEFAULT_IDEAS[l].map(text => ({ text, checked: false })),
    };
  }
  return state;
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let currentLetter = null;

// ── Build grid ──
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

let photoContext = null;

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
        resolve(canvas.toDataURL('image/jpeg', 0.78));
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
  const photos = state[letter].ideas[idx].photos || [];
  photoGrid.innerHTML = '';

  if (photos.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'photo-empty';
    msg.textContent = 'Aucune photo — ajoutes-en une !';
    photoGrid.appendChild(msg);
    return;
  }

  photos.forEach((src, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'photo-thumb';

    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.addEventListener('click', () => window.open(src, '_blank'));

    const del = document.createElement('button');
    del.className = 'photo-del';
    del.textContent = '✕';
    del.addEventListener('click', e => {
      e.stopPropagation();
      state[letter].ideas[idx].photos.splice(i, 1);
      saveState(state);
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
  const files = Array.from(e.target.files);
  if (!files.length) return;

  for (const file of files) {
    const resized = await resizeImage(file);
    if (!state[letter].ideas[idx].photos) state[letter].ideas[idx].photos = [];
    state[letter].ideas[idx].photos.push(resized);
  }
  saveState(state);
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
        item.addEventListener('click', () => {
          state._next = { letter, text: idea.text };
          saveState(state);
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
  const next = state._next;
  nextCard.innerHTML = '';
  if (!next) {
    nextCard.classList.remove('filled');
    const empty = document.createElement('span');
    empty.className = 'next-empty';
    empty.textContent = 'Aucune activité choisie — clique sur ➔ dans le panneau pour en définir une';
    nextCard.appendChild(empty);
    return;
  }

  nextCard.classList.add('filled');

  const badge = document.createElement('div');
  badge.className = 'next-badge';
  badge.textContent = next.letter;

  const info = document.createElement('div');
  info.className = 'next-info';

  const activity = document.createElement('div');
  activity.className = 'next-activity';
  activity.textContent = next.text;
  info.appendChild(activity);

  const clearBtn = document.createElement('button');
  clearBtn.className = 'next-clear';
  clearBtn.textContent = '✕';
  clearBtn.title = 'Effacer';
  clearBtn.addEventListener('click', () => {
    state._next = null;
    saveState(state);
    renderNextCard();
    if (currentLetter) renderIdeas();
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
    checkbox.addEventListener('change', () => {
      state[currentLetter].ideas[idx].checked = checkbox.checked;
      textEl.classList.toggle('checked', checkbox.checked);
      saveState(state);
      updateCard(currentLetter);
    });

    const textEl = document.createElement('span');
    textEl.className = 'idea-text' + (idea.checked ? ' checked' : '');
    textEl.textContent = idea.text;

    const photoCount = idea.photos?.length || 0;
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
    delBtn.addEventListener('click', () => {
      if (state._next?.letter === currentLetter && state._next?.text === idea.text) {
        state._next = null;
        renderNextCard();
      }
      state[currentLetter].ideas.splice(idx, 1);
      saveState(state);
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


function addIdea() {
  const text = newIdeaInput.value.trim();
  if (!text || !currentLetter) return;
  state[currentLetter].ideas.push({ text, checked: false });
  saveState(state);
  newIdeaInput.value = '';
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

// ── Init ──
ALPHABET.forEach(l => {
  createCard(l);
  updateCard(l);
});
renderNextCard();
