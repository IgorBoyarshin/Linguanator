export class Connection {
    from: number;
    to: number[];

    constructor(from: number, to: number[]) {
        this.from = from;
        this.to = to;
    }
}