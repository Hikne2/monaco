import * as monaco from "monaco-editor";

export const theme = {
    dark: "vs-dark",
    light: "vs"
}

let editor;
export async function setup(container, opts) {
    editor = monaco.editor.create(container, { // https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IStandaloneCodeEditor.html
        bracketPairColorization: { enabled: true },
        colorDecorators: true,
        colorDecoratorsActivatedOn: "click",
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        definitionLinkOpensInPeek: true,
        minimap: { enabled: false },
        roundedSelection: true,
        showUnused: true,
        smoothScrolling: true,

        fontFamily: "monospace",
        fontLigatures: true,
        fontSize: 24,
        renderWhitespace: "selection",

        model: null,
        theme: opts.theme || themes.dark
    });

    /*
    editor.setSelections(editor.getSelections());
    editor.defineTheme(name, data);
    editor.setTheme(name);
    */

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        allowNonTsExtensions: true,
        allowJs: false,
        checkJs: false,
        strict: true,
        esModuleInterop: false,
        forceConsistentCasingInFileNames: true,
        skipLibCheck: true,
        baseUrl: "file:///scripts",
        paths: {
            "*": ["file:///scripts/*", "file:///*"],
        },
        resolveJsonModule: true,
        noUnusedLocals: true,
        noUnusedParameters: true
    });

    // tsWorker = await monaco.languages.typescript.getTypeScriptWorker();
}

class VFS {
    constructor() {
        this.files = {};
        this.models = {};
    }

    _normalize(path) {
        return path.replace(/^\.?\/*/, "");
    }

    _uri(path) {
        return monaco.Uri.parse(`file:///${this._normalize(path)}`);
    }

    setFile(path, content) {
        path = this._normalize(path);
        this.files[path] = content;

        if (this.models[path]) {
            this.models[path].setValue(content);
        }
    }

    getFile(path) {
        return this.files[this._normalize(path)];
    }

    deleteFile(path) {
        path = this._normalize(path);
        delete this.files[path];

        if (this.models[path]) {
            this.models[path].dispose();
            delete this.models[path];
        }
    }

    createModel(path, lang) {
        path = this._normalize(path);
        const uri = this._uri(path);

        if (this.models[path]) return this.models[path];

        const model = monaco.editor.createModel(this.files[path] || "", lang, uri);
        this.models[path] = model;

        return model;
    }

    openModel(path) {
        path = this._normalize(path);
        if (!this.models[path]) return;

        editor.setModel(this.models[path]);
    }

    modelExists(path) {
        path = this._normalize(path);
        return !!this.models[path];
    }

    listFiles() {
        return Object.keys(this.files);
    }
}

const vfs = new VFS();

export const script = {
    create(path, content = "", lang = "typescript") {
        const full = `scripts/${path}`;
        vfs.setFile(full, content);
        vfs.createModel(full, lang);
    },

    delete(path) {
        vfs.deleteFile(`scripts/${path}`);
    },

    get(path) {
        return vfs.getFile(`scripts/${path}`);
    },

    open(path) {
        vfs.openModel(`scripts/${path}`);
    }
};

let tsWorker = null;
const tsClients = new Map();

export async function defineModule(name, code) {
    const moduleName = "|" + name;

    const encoded = encodeURIComponent(moduleName);
    const uri = monaco.Uri.parse(`file:///${encoded}.ts`);

    const model = monaco.editor.createModel(code, "typescript", uri);

    let client = tsClients.get(uri.toString());
    if (!client) {
        client = await tsWorker(uri);
        tsClients.set(uri.toString(), client);
    }

    const result = await client.getEmitOutput(uri.toString(), true);

    let dts = "";
    for (const f of result.outputFiles) {
        if (f.name.endsWith(".d.ts")) dts = f.text;
    }

    model.dispose();

    monaco.languages.typescript.typescriptDefaults.addExtraLib(
        dts,
        `file:///${encoded}.d.ts`
    );
}