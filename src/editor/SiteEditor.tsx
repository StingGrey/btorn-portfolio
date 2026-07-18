import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  LayoutList,
  Pencil,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import initialContent from '../content/site-content.json';
import {
  DEFAULT_SECTION_ORDER,
  defaultSiteText,
  editorSectionById,
  editorSections,
  type SiteSectionId,
} from '../content/site-copy';

type SiteContent = {
  text: Record<string, string>;
  sections: {
    order: SiteSectionId[];
    hidden: SiteSectionId[];
  };
};

type EditorTab = 'content' | 'sections';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type SiteEditorContextValue = {
  text: (key: string) => string;
  sectionOrder: SiteSectionId[];
  isHidden: (id: SiteSectionId) => boolean;
};

type SiteEditorControlValue = SiteEditorContextValue & {
  available: boolean;
  editMode: boolean;
  dirty: boolean;
  saveState: SaveState;
  selectedSection: SiteSectionId;
  selectedField: string | null;
  tab: EditorTab;
  setTab: (tab: EditorTab) => void;
  setSelectedSection: (id: SiteSectionId) => void;
  setSelectedField: (key: string | null) => void;
  updateText: (key: string, value: string) => void;
  moveSection: (id: SiteSectionId, direction: -1 | 1) => void;
  toggleSection: (id: SiteSectionId) => void;
  resetSection: (id: SiteSectionId) => void;
  resetAll: () => void;
  save: () => Promise<void>;
  openEditor: () => void;
  closeEditor: () => void;
};

const SiteEditorContext = createContext<SiteEditorControlValue | null>(null);

function normalizeContent(raw: unknown): SiteContent {
  const candidate = raw && typeof raw === 'object' ? (raw as Partial<SiteContent>) : {};
  const text = candidate.text && typeof candidate.text === 'object' ? candidate.text : {};
  const rawOrder = Array.isArray(candidate.sections?.order) ? candidate.sections.order : [];
  const rawHidden = Array.isArray(candidate.sections?.hidden) ? candidate.sections.hidden : [];
  const knownSections = new Set<SiteSectionId>(DEFAULT_SECTION_ORDER);
  const order = rawOrder.filter((id): id is SiteSectionId => knownSections.has(id as SiteSectionId));

  DEFAULT_SECTION_ORDER.forEach((id) => {
    if (!order.includes(id)) order.push(id);
  });

  return {
    text: Object.fromEntries(Object.entries(text).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
    sections: {
      order,
      hidden: rawHidden.filter((id): id is SiteSectionId => knownSections.has(id as SiteSectionId)),
    },
  };
}

function isLoopbackHost() {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

export function SiteEditorProvider({ children }: { children: ReactNode }) {
  const available = import.meta.env.DEV && isLoopbackHost();
  const [content, setContent] = useState<SiteContent>(() => normalizeContent(initialContent));
  const [editMode, setEditMode] = useState(
    () => available && new URLSearchParams(window.location.search).get('edit') === '1',
  );
  const [selectedSection, setSelectedSection] = useState<SiteSectionId>('profile');
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab>('content');
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const text = useCallback(
    (key: string) => content.text[key] ?? defaultSiteText[key] ?? '',
    [content.text],
  );

  const updateContent = useCallback((updater: (current: SiteContent) => SiteContent) => {
    setContent((current) => updater(current));
    setDirty(true);
    setSaveState('idle');
  }, []);

  const updateText = useCallback(
    (key: string, value: string) => {
      updateContent((current) => {
        const nextText = { ...current.text };
        if (value === defaultSiteText[key]) {
          delete nextText[key];
        } else {
          nextText[key] = value;
        }
        return { ...current, text: nextText };
      });
    },
    [updateContent],
  );

  const moveSection = useCallback(
    (id: SiteSectionId, direction: -1 | 1) => {
      updateContent((current) => {
        const order = [...current.sections.order];
        const from = order.indexOf(id);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= order.length) return current;
        [order[from], order[to]] = [order[to], order[from]];
        return { ...current, sections: { ...current.sections, order } };
      });
    },
    [updateContent],
  );

  const toggleSection = useCallback(
    (id: SiteSectionId) => {
      updateContent((current) => {
        const hidden = current.sections.hidden.includes(id)
          ? current.sections.hidden.filter((item) => item !== id)
          : [...current.sections.hidden, id];
        return { ...current, sections: { ...current.sections, hidden } };
      });
    },
    [updateContent],
  );

  const resetSection = useCallback(
    (id: SiteSectionId) => {
      const keys = new Set(editorSectionById[id].fields.map((item) => item.key));
      updateContent((current) => ({
        ...current,
        text: Object.fromEntries(Object.entries(current.text).filter(([key]) => !keys.has(key))),
      }));
    },
    [updateContent],
  );

  const resetAll = useCallback(() => {
    if (!window.confirm('要恢复所有默认文字和区块顺序吗？这一步保存后才会写入项目。')) return;
    setContent(normalizeContent({}));
    setDirty(true);
    setSaveState('idle');
  }, []);

  const save = useCallback(async () => {
    if (!available) return;
    setSaveState('saving');
    try {
      const response = await fetch('/__site-editor/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      });
      if (!response.ok) throw new Error(await response.text());
      setDirty(false);
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 2200);
    } catch (error) {
      console.error('Unable to save site content', error);
      setSaveState('error');
    }
  }, [available, content]);

  const setEditorQuery = useCallback((enabled: boolean) => {
    const url = new URL(window.location.href);
    if (enabled) url.searchParams.set('edit', '1');
    else url.searchParams.delete('edit');
    window.history.replaceState({}, '', url);
  }, []);

  const openEditor = useCallback(() => {
    if (!available) return;
    setEditorQuery(true);
    setEditMode(true);
  }, [available, setEditorQuery]);

  const closeEditor = useCallback(() => {
    if (dirty && !window.confirm('还有未保存的修改，确定先退出编辑模式吗？')) return;
    setEditorQuery(false);
    setEditMode(false);
  }, [dirty, setEditorQuery]);

  const isHidden = useCallback((id: SiteSectionId) => content.sections.hidden.includes(id), [content.sections.hidden]);

  useEffect(() => {
    document.body.classList.toggle('site-editor-active', editMode);
    return () => document.body.classList.remove('site-editor-active');
  }, [editMode]);

  useEffect(() => {
    if (!editMode || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, editMode]);

  useEffect(() => {
    if (!editMode) return;
    const captureSelection = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest('[data-site-editor-ui]')) return;

      const section = target.closest<HTMLElement>('[data-editor-section]');
      if (!section) return;
      const sectionId = section.dataset.editorSection as SiteSectionId;
      if (!editorSectionById[sectionId]) return;

      setSelectedSection(sectionId);
      setTab('content');
      const fieldNode = target.closest<HTMLElement>('[data-editor-field]');
      setSelectedField(fieldNode?.dataset.editorField ?? null);

      if (target.closest('a')) event.preventDefault();
    };

    document.addEventListener('click', captureSelection, true);
    return () => document.removeEventListener('click', captureSelection, true);
  }, [editMode]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('[data-editor-section]').forEach((node) => {
        const id = node.dataset.editorSection as SiteSectionId;
        node.toggleAttribute('data-editor-selected', editMode && id === selectedSection);
        node.toggleAttribute('data-site-hidden', content.sections.hidden.includes(id));
      });
      window.dispatchEvent(new Event('resize'));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [content.sections.hidden, content.sections.order, editMode, selectedSection]);

  useEffect(() => {
    if (!editMode || !selectedField) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-editor-input="${CSS.escape(selectedField)}"]`)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editMode, selectedField]);

  const value = useMemo<SiteEditorControlValue>(
    () => ({
      available,
      editMode,
      dirty,
      saveState,
      selectedSection,
      selectedField,
      tab,
      text,
      sectionOrder: content.sections.order,
      isHidden,
      setTab,
      setSelectedSection,
      setSelectedField,
      updateText,
      moveSection,
      toggleSection,
      resetSection,
      resetAll,
      save,
      openEditor,
      closeEditor,
    }),
    [
      available,
      closeEditor,
      content.sections.order,
      dirty,
      editMode,
      isHidden,
      moveSection,
      openEditor,
      resetAll,
      resetSection,
      save,
      saveState,
      selectedField,
      selectedSection,
      tab,
      text,
      toggleSection,
      updateText,
    ],
  );

  return <SiteEditorContext.Provider value={value}>{children}</SiteEditorContext.Provider>;
}

function useEditorContext() {
  const value = useContext(SiteEditorContext);
  if (!value) throw new Error('Site editor must be used inside SiteEditorProvider');
  return value;
}

export function useSiteContent(): SiteEditorContextValue {
  const { text, sectionOrder, isHidden } = useEditorContext();
  return { text, sectionOrder, isHidden };
}

function ContentPanel() {
  const {
    selectedSection,
    selectedField,
    setSelectedSection,
    setSelectedField,
    text,
    updateText,
    resetSection,
  } = useEditorContext();
  const section = editorSectionById[selectedSection];

  return (
    <div className="site-editor-fields">
      <label className="site-editor-select-label" htmlFor="site-editor-section-select">正在编辑</label>
      <select
        id="site-editor-section-select"
        value={selectedSection}
        onChange={(event) => {
          const id = event.target.value as SiteSectionId;
          setSelectedSection(id);
          setSelectedField(null);
          document.querySelector<HTMLElement>(`[data-editor-section="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
      >
        {editorSections.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
      </select>
      <p className="site-editor-hint">{section.hint}</p>

      <div className="site-editor-field-list">
        {section.fields.map((item) => {
          const Input = item.multiline ? 'textarea' : 'input';
          return (
            <label className="site-editor-field" data-active={selectedField === item.key} key={item.key}>
              <span>{item.label}</span>
              <Input
                data-editor-input={item.key}
                type={Input === 'input' ? item.type ?? 'text' : undefined}
                value={text(item.key)}
                rows={item.multiline ? 4 : undefined}
                onFocus={() => setSelectedField(item.key)}
                onChange={(event) => updateText(item.key, event.target.value)}
              />
            </label>
          );
        })}
      </div>

      <button className="site-editor-reset-section" type="button" onClick={() => resetSection(selectedSection)}>
        <RotateCcw size={15} />
        恢复本区默认文字
      </button>
    </div>
  );
}

function SectionPanel() {
  const {
    sectionOrder,
    isHidden,
    moveSection,
    toggleSection,
    setSelectedSection,
    setSelectedField,
    setTab,
    resetAll,
  } = useEditorContext();

  return (
    <div className="site-editor-sections">
      <p className="site-editor-hint">用箭头调整顺序，眼睛按钮控制访客能否看到。隐藏内容仍然保留。</p>
      <ol>
        {sectionOrder.map((id, index) => {
          const section = editorSectionById[id];
          const hidden = isHidden(id);
          return (
            <li data-hidden={hidden} key={id}>
              <button
                className="site-editor-section-name"
                type="button"
                onClick={() => {
                  setSelectedSection(id);
                  setSelectedField(null);
                  setTab('content');
                  document.querySelector<HTMLElement>(`[data-editor-section="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              >
                <small>{String(index + 1).padStart(2, '0')}</small>
                <span>{section.label}</span>
              </button>
              <div className="site-editor-section-actions">
                <button type="button" onClick={() => moveSection(id, -1)} disabled={index === 0} aria-label={`上移${section.label}`} title="上移">
                  <ChevronUp size={15} />
                </button>
                <button type="button" onClick={() => moveSection(id, 1)} disabled={index === sectionOrder.length - 1} aria-label={`下移${section.label}`} title="下移">
                  <ChevronDown size={15} />
                </button>
                <button type="button" onClick={() => toggleSection(id)} aria-label={`${hidden ? '显示' : '隐藏'}${section.label}`} title={hidden ? '显示' : '隐藏'}>
                  {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <button className="site-editor-reset-section" type="button" onClick={resetAll}>
        <RotateCcw size={15} />
        恢复全部默认设置
      </button>
    </div>
  );
}

export function SiteEditor() {
  const {
    available,
    editMode,
    dirty,
    saveState,
    tab,
    setTab,
    save,
    openEditor,
    closeEditor,
  } = useEditorContext();

  if (!available) return null;

  if (!editMode) {
    return (
      <button className="site-editor-launcher" data-site-editor-ui type="button" onClick={openEditor}>
        <Pencil size={16} />
        编辑页面
      </button>
    );
  }

  const saveLabel = saveState === 'saving'
    ? '保存中'
    : saveState === 'saved'
      ? '已保存'
      : saveState === 'error'
        ? '保存失败'
        : dirty
          ? '保存修改'
          : '已经保存';

  return (
    <aside className="site-editor-panel" data-site-editor-ui aria-label="本地页面编辑器">
      <header className="site-editor-header">
        <div>
          <span className="site-editor-local-dot" />
          <p>仅限本机</p>
          <h2>小窝编辑器</h2>
        </div>
        <button type="button" onClick={closeEditor} aria-label="退出编辑模式" title="退出编辑模式">
          <X size={18} />
        </button>
      </header>

      <div className="site-editor-tabs" role="tablist" aria-label="编辑器功能">
        <button type="button" role="tab" aria-selected={tab === 'content'} onClick={() => setTab('content')}>
          <FileText size={16} />
          文字内容
        </button>
        <button type="button" role="tab" aria-selected={tab === 'sections'} onClick={() => setTab('sections')}>
          <LayoutList size={16} />
          页面区块
        </button>
      </div>

      <div className="site-editor-scroll-area">
        {tab === 'content' ? <ContentPanel /> : <SectionPanel />}
      </div>

      <footer className="site-editor-footer">
        <p aria-live="polite">
          {saveState === 'error' ? '保存失败，请检查开发服务器。' : dirty ? '有尚未保存的修改' : '内容已经写入项目'}
        </p>
        <button type="button" onClick={() => void save()} disabled={saveState === 'saving' || (!dirty && saveState !== 'error')} data-state={saveState}>
          {saveState === 'saved' ? <Check size={17} /> : <Save size={17} />}
          {saveLabel}
        </button>
      </footer>
    </aside>
  );
}
