interface Definition {
    def: string;
    trans: string;
    examp: string;
}

interface Pron {
    /** Region */
    region: string;
    lab: string;
    /** Audio */
    aud: string;
    ipa: string;
}

interface Entry {
    word: string;
    pos: string;
    prons: Pron[];
    defs: Definition[];
}

type DictDef = JQuery<HTMLElement> & {originSource: any}