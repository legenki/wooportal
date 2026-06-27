import { readData, writeData } from '../lib/storage';
import type { ProxyProfile, WooPortalData } from '../types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let data: WooPortalData;
let editingId: string | null = null;

async function init(): Promise<void> {
  data = await readData();
  renderProfiles();
  wireEvents();
}

function renderProfiles(): void {
  const list = byId<HTMLElement>('profilesList');
  if (data.profiles.length === 0) {
    list.innerHTML = '<p class="empty-msg">No proxy profiles yet. Click "+ Add Profile" to create one.</p>';
    return;
  }
  list.innerHTML = data.profiles.map(p => `
    <div class="profile-row">
      <span class="profile-dot" style="background:${p.color}"></span>
      <span class="profile-name">${escHtml(p.name)}</span>
      <span class="profile-meta">${escHtml(p.config.type.toUpperCase())} · ${escHtml(p.config.type === 'pac' ? p.config.pacUrl : `${p.config.host}:${p.config.port}`)}</span>
      <button class="btn-edit" data-id="${p.id}">Edit</button>
    </div>`).join('');
  list.querySelectorAll<HTMLButtonElement>('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id!));
  });
}

function openModal(profileId?: string): void {
  editingId = profileId ?? null;
  byId<HTMLElement>('modalTitle').textContent = editingId ? 'Edit Profile' : 'Add Profile';
  byId<HTMLElement>('deleteProfileBtn').style.display = editingId ? 'inline-block' : 'none';

  const profile = editingId ? data.profiles.find(p => p.id === editingId) : null;
  byId<HTMLInputElement>('pName').value = profile?.name ?? '';
  byId<HTMLInputElement>('pColor').value = profile?.color ?? '#0969da';
  byId<HTMLSelectElement>('pType').value = profile?.config.type ?? 'http';
  byId<HTMLInputElement>('pHost').value = profile?.config.host ?? '';
  byId<HTMLInputElement>('pPort').value = String(profile?.config.port ?? '');
  byId<HTMLInputElement>('pPacUrl').value = profile?.config.pacUrl ?? '';
  byId<HTMLInputElement>('pUser').value = profile?.config.auth.username ?? '';
  byId<HTMLInputElement>('pPass').value = profile?.config.auth.password ?? '';
  updateTypeFields();
  byId<HTMLElement>('modalOverlay').style.display = 'flex';
}

function closeModal(): void {
  byId<HTMLElement>('modalOverlay').style.display = 'none';
  editingId = null;
}

function updateTypeFields(): void {
  const isPac = byId<HTMLSelectElement>('pType').value === 'pac';
  byId<HTMLElement>('hostPortFields').style.display = isPac ? 'none' : 'flex';
  byId<HTMLElement>('hostPortFields').style.flexDirection = 'column';
  byId<HTMLElement>('hostPortFields').style.gap = '14px';
  byId<HTMLElement>('pacFields').style.display = isPac ? 'block' : 'none';
}

async function saveProfile(): Promise<void> {
  const name = byId<HTMLInputElement>('pName').value.trim();
  if (!name) { alert('Name is required'); return; }
  const type = byId<HTMLSelectElement>('pType').value as ProxyProfile['config']['type'];
  const now = new Date().toISOString();
  const existing = editingId ? data.profiles.find(p => p.id === editingId) : null;
  const profile: ProxyProfile = {
    id: editingId ?? generateId(),
    name,
    description: '',
    color: byId<HTMLInputElement>('pColor').value,
    config: {
      type,
      host: byId<HTMLInputElement>('pHost').value.trim(),
      port: parseInt(byId<HTMLInputElement>('pPort').value) || 0,
      pacUrl: byId<HTMLInputElement>('pPacUrl').value.trim(),
      auth: {
        username: byId<HTMLInputElement>('pUser').value,
        password: byId<HTMLInputElement>('pPass').value,
      },
      bypassList: existing?.config.bypassList ?? [],
      routingRules: existing?.config.routingRules ?? { enabled: false, mode: 'whitelist', domains: [] },
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    tags: existing?.tags ?? [],
  };

  data.profiles = editingId
    ? data.profiles.map(p => p.id === editingId ? profile : p)
    : [...data.profiles, profile];

  await writeData(data);
  const status = byId<HTMLElement>('saveStatus');
  status.textContent = 'Saved ✓';
  setTimeout(() => { status.textContent = ''; }, 2000);
  renderProfiles();
  closeModal();
}

async function deleteProfile(): Promise<void> {
  if (!editingId) return;
  if (!confirm('Delete this profile? This cannot be undone.')) return;
  data.profiles = data.profiles.filter(p => p.id !== editingId);
  if (data.activeProfileId === editingId) {
    data.activeProfileId = undefined;
    data.mode = 'system';
  }
  await writeData(data);
  renderProfiles();
  closeModal();
}

function wireEvents(): void {
  byId<HTMLButtonElement>('addProfileBtn').addEventListener('click', () => openModal());
  byId<HTMLButtonElement>('saveProfileBtn').addEventListener('click', saveProfile);
  byId<HTMLButtonElement>('cancelModalBtn').addEventListener('click', closeModal);
  byId<HTMLButtonElement>('deleteProfileBtn').addEventListener('click', deleteProfile);
  byId<HTMLSelectElement>('pType').addEventListener('change', updateTypeFields);
  byId<HTMLElement>('modalOverlay').addEventListener('click', e => {
    if (e.target === byId<HTMLElement>('modalOverlay')) closeModal();
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', init);
