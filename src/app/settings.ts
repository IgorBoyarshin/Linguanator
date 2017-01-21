import { Language } from './language';

export class Settings {
    languages: {
        registeredLanguages: Language[];
        // lastUsedId: number;
    };

    tags: {
        registeredTags: string[];
        defaultTag: string;
    };

    // toJSON(): string {
    //     return JSON.stringify(this);
    // }
    //
    // static fromJSON(json: any): Settings {
    //     return (json as Settings);
    // }
}
