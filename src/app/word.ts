export class Word {
    id: number; // Id
    w: string; // Word
    s: number; // Score
    t: string[]; // Tags

    constructor(id: number, word: string, score: number, tags: string[]) {
        this.id = id;
        this.w = word;
        this.s = score;
        this.t = tags;
    }
}
