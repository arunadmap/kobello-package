// Notes: a small Kobello app. Each note is a Markdown file in the app's own folder.
//
// It uses every part of the SDK:
//   files          the notes themselves (notes/<title>.md)
//   storage        settings: the last open note and "notify me when saved"
//   notifications  "Note saved"
//   links          the link to the guide, opened in the user's browser

import { useCallback, useEffect, useState } from 'react';
import { isKobelloError, kobello, type FileInfo } from '@kobello/sdk';

const NOTES_DIR = 'notes';
const GUIDE_URL = 'https://github.com/arunadmap/kobello-package/blob/main/docs/GUIDE.md';

// Names Windows keeps for devices ("con.md" can't be a file there), so Kobello refuses them.
const RESERVED_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)$/;

/** "Shopping list!" → "shopping-list". File names only use letters, numbers and dashes. */
const toFileName = (title: string) => {
  const name = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return RESERVED_NAMES.test(name) ? `note-${name}` : name;
};
const titleOf = (file: FileInfo) => file.name.replace(/\.md$/, '');

export default function App() {
  if (!kobello.isAvailable()) return <p className="outside">Open Notes inside the Kobello app.</p>;
  return <Notes />;
}

function Notes() {
  const [notes, setNotes] = useState<FileInfo[]>([]);
  const [current, setCurrent] = useState<string | null>(null); // path of the open note
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [notifyOnSave, setNotifyOnSave] = useState(false);
  const [error, setError] = useState('');

  /** Shows an SDK error to the user. */
  const report = (cause: unknown) => setError(isKobelloError(cause) ? cause.message : String(cause));

  /** The notes folder, newest first. It doesn't exist until the first note is saved. */
  const refresh = useCallback(async () => {
    try {
      const files = await kobello.files.list(NOTES_DIR);
      setNotes(files.filter(file => file.type === 'file').sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)));
    } catch (cause) {
      if (isKobelloError(cause) && cause.code === 'NOT_FOUND') setNotes([]);
      else throw cause;
    }
  }, []);

  const open = useCallback(async (path: string) => {
    setText(await kobello.files.read(path));
    setCurrent(path);
    setDirty(false);
    await kobello.storage.set('lastNote', path); // reopen it next time
  }, []);

  // On start: load the notes and the settings, and reopen the last note.
  useEffect(() => {
    (async () => {
      await refresh();
      setNotifyOnSave((await kobello.storage.get<boolean>('notifyOnSave')) ?? false);
      const last = await kobello.storage.get<string>('lastNote');
      if (last && await kobello.files.stat(last)) await open(last);
    })().catch(report);
  }, [refresh, open]);

  async function create() {
    const name = toFileName(newTitle);
    if (!name) return;
    const path = `${NOTES_DIR}/${name}.md`;
    try {
      if (await kobello.files.stat(path)) return setError(`A note called "${name}" already exists.`);
      await kobello.files.write(path, `# ${newTitle.trim()}\n\n`, { createDirs: true });
      setNewTitle('');
      await refresh();
      await open(path);
    } catch (cause) {
      report(cause);
    }
  }

  async function save() {
    if (!current) return;
    try {
      await kobello.files.write(current, text);
      setDirty(false);
      await refresh();
      if (notifyOnSave) await kobello.notifications.show({ title: 'Note saved', body: current.split('/').pop() });
    } catch (cause) {
      report(cause);
    }
  }

  async function remove() {
    if (!current || !confirm('Delete this note?')) return;
    try {
      await kobello.files.delete(current);
      await kobello.storage.delete('lastNote');
      setCurrent(null);
      setText('');
      await refresh();
    } catch (cause) {
      report(cause);
    }
  }

  async function toggleNotify(value: boolean) {
    setNotifyOnSave(value);
    await kobello.storage.set('notifyOnSave', value).catch(report);
  }

  return <div className="notes">
    <aside>
      <form onSubmit={event => { event.preventDefault(); void create(); }}>
        <input placeholder="New note title" value={newTitle} onChange={event => setNewTitle(event.target.value)} />
        <button disabled={!toFileName(newTitle)}>Add</button>
      </form>
      <ul>
        {notes.map(note => <li key={note.path}>
          <button className={note.path === current ? 'active' : ''} onClick={() => void open(note.path).catch(report)}>{titleOf(note)}</button>
        </li>)}
      </ul>
      <label className="setting">
        <input type="checkbox" checked={notifyOnSave} onChange={event => void toggleNotify(event.target.checked)} />
        Notify me when a note is saved
      </label>
      <button className="link" onClick={() => void kobello.links.open(GUIDE_URL).catch(report)}>How this app was built ↗</button>
    </aside>

    <main>
      {error && <p className="error" role="alert" onClick={() => setError('')}>{error}</p>}
      {current ? <>
        <div className="actions">
          <span>{current}{dirty ? ' (not saved)' : ''}</span>
          <button onClick={() => void save()} disabled={!dirty}>Save</button>
          <button onClick={() => void remove()}>Delete</button>
        </div>
        <textarea value={text} onChange={event => { setText(event.target.value); setDirty(true); }}
          // Ctrl/Cmd+S saves.
          onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 's') { event.preventDefault(); void save(); } }} />
      </> : <p className="empty">Add a note, or pick one on the left.</p>}
    </main>
  </div>;
}
