// MENTIX — wspólna baza (Firebase): konta, role i zestawy.
// - Bez konta przeglądarka jest zalogowana anonimowo (może grać i publikować publiczne zestawy).
// - Konto = login + hasło (Firebase Auth, e-mail techniczny <login>@konta.mentix.app).
//   Rejestracja „podnosi” konto anonimowe, więc zestawy opublikowane wcześniej zostają przy tym samym właścicielu.
// - Role trzymamy w kolekcji mentix_users ({ login, role: 'user' | 'admin' }).
// Konfiguracja Firebase w aplikacji webowej jest publiczna z założenia — bezpieczeństwo dają reguły Firestore
// (patrz firestore-mentix.rules).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth, signInAnonymously, onAuthStateChanged, EmailAuthProvider, linkWithCredential,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, query, where, limit
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB29VUpW8zOIGBgdYPAvDvkLIX95wGhZyo',
  authDomain: 'my-games-scratch.firebaseapp.com',
  projectId: 'my-games-scratch',
  storageBucket: 'my-games-scratch.firebasestorage.app',
  messagingSenderId: '499586372781',
  appId: '1:499586372781:web:d2081ee86ae8ebecd76224'
};
const SETS = 'mentix_sets';
const USERS = 'mentix_users';
const DOMAIN = 'konta.mentix.app';
const BOOT_ADMIN = 'tpraglowski';          // ten login jest zawsze administratorem (to samo w regułach)

const app = initializeApp(firebaseConfig, 'mentix');
const auth = getAuth(app);
const db = getFirestore(app);

const emailOf = login => login + '@' + DOMAIN;
const loginOf = user => String((user && user.email) || '').split('@')[0];
const err = code => Object.assign(new Error(code), { code });

function toSet(snap) {
  const d = snap.data();
  return {
    id: snap.id, title: d.title, desc: d.desc || '', emoji: d.emoji || '📝',
    visibility: d.visibility === 'private' ? 'private' : 'public',
    questions: Array.isArray(d.questions) ? d.questions : [], author: d.author || '', ownerUid: d.ownerUid,
    updatedAt: d.updatedAt || 0, remote: true
  };
}

async function loadProfile(user) {
  const login = loginOf(user);
  const ref = doc(db, USERS, user.uid);
  let data = { login, role: 'user', createdAt: Date.now() };
  try {
    const s = await getDoc(ref);
    if (s.exists()) data = s.data();
    else await setDoc(ref, data);
  } catch (e) { console.warn('MENTIX profil:', e); }
  return { login: data.login || login, role: data.role === 'admin' || login === BOOT_ADMIN ? 'admin' : 'user' };
}

const listeners = [];
let lastKey = '';
function emit() {
  const key = api.uid + '|' + (api.account ? api.account.login + ':' + api.account.role : '');
  if (key === lastKey) return;
  lastKey = key;
  listeners.forEach(f => { try { f(api); } catch (e) { console.error(e); } });
}
async function applyUser(user) {
  api.uid = user.uid;
  api.account = user.isAnonymous ? null : await loadProfile(user);
  api.isAdmin = !!(api.account && api.account.role === 'admin');
}

const api = {
  uid: null,
  account: null,          // { login, role } albo null (gość)
  isAdmin: false,
  onChange(fn) { listeners.push(fn); },
  validLogin: l => /^[a-z0-9_]{3,16}$/.test(l),

  async register(login, password) {
    login = String(login || '').trim().toLowerCase();
    if (!api.validLogin(login)) throw err('bad-login');
    const cred = EmailAuthProvider.credential(emailOf(login), password);
    const cur = auth.currentUser;
    const user = cur && cur.isAnonymous
      ? (await linkWithCredential(cur, cred)).user
      : (await createUserWithEmailAndPassword(auth, emailOf(login), password)).user;
    await user.getIdToken(true);              // świeży token z e-mailem (potrzebny regułom)
    await applyUser(user);
    emit();
  },
  async login(login, password) {
    login = String(login || '').trim().toLowerCase();
    if (!api.validLogin(login)) throw err('auth/invalid-credential');
    const user = (await signInWithEmailAndPassword(auth, emailOf(login), password)).user;
    await applyUser(user);
    emit();
  },
  async logout() {
    await signOut(auth);                      // onAuthStateChanged zaloguje z powrotem anonimowo
  },

  // ----- zestawy -----
  async listPublic() {
    const snap = await getDocs(query(collection(db, SETS), where('visibility', '==', 'public'), limit(300)));
    return snap.docs.map(toSet).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async listMine() {
    if (!api.uid) return [];
    const snap = await getDocs(query(collection(db, SETS), where('ownerUid', '==', api.uid), limit(500)));
    return snap.docs.map(toSet);
  },
  async save(set, author) {
    await setDoc(doc(db, SETS, set.id), {
      title: String(set.title).slice(0, 60),
      desc: String(set.desc || '').slice(0, 300),
      emoji: String(set.emoji || '📝').slice(0, 8),
      visibility: set.visibility === 'private' ? 'private' : 'public',
      questions: JSON.parse(JSON.stringify(set.questions)),
      author: String(author || '').slice(0, 16),
      ownerUid: api.uid,
      updatedAt: set.updatedAt || Date.now()
    });
  },
  async remove(id) {
    const ref = doc(db, SETS, id);
    let s;
    try { s = await getDoc(ref); } catch (e) { return; }   // brak dostępu = nie nasz / nie istnieje
    if (s.exists() && (s.data().ownerUid === api.uid || api.isAdmin)) await deleteDoc(ref);
  },

  // ----- administrator -----
  async listUsers() {
    const snap = await getDocs(query(collection(db, USERS), limit(1000)));
    return snap.docs.map(d => ({ uid: d.id, login: d.data().login, role: d.data().role === 'admin' || d.data().login === BOOT_ADMIN ? 'admin' : 'user', boot: d.data().login === BOOT_ADMIN, createdAt: d.data().createdAt || 0 }))
      .sort((a, b) => a.login.localeCompare(b.login));
  },
  async setRole(uid, role) {
    await updateDoc(doc(db, USERS, uid), { role: role === 'admin' ? 'admin' : 'user' });
  },
  async adminDeleteSet(id) {
    await deleteDoc(doc(db, SETS, id));
  }
};

let first = true;
onAuthStateChanged(auth, async user => {
  if (!user) {
    try { await signInAnonymously(auth); }
    catch (e) { console.warn('MENTIX: brak połączenia z bazą', e); if (first) { first = false; Q._cloudResolve(null); } }
    return;
  }
  await applyUser(user);
  if (first) { first = false; lastKey = api.uid + '|' + (api.account ? api.account.login + ':' + api.account.role : ''); Q._cloudResolve(api); }
  else emit();
});
