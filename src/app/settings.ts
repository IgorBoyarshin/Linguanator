export class Settings {
    languages: {
        registeredLanguages: Language[];
        lastUsedId: number;
    };

    // toJSON(): string {
    //     return JSON.stringify(this);
    // }
    //
    // static fromJSON(json: any): Settings {
    //     return (json as Settings);
    // }
}

export class Language {
    id: number;
    name: string;
    label: string;

    // constructor (id: number, name: string, label: string) {
    //     this.id = id;
    //     this.name = name;
    //     this.label = label;
    // }
}
