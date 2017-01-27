import { Injectable } from '@angular/core';
import { Headers, Http, RequestOptions } from '@angular/http';
// import {Http, Response, Headers, RequestOptions} from "@angular/http";

import { Settings } from './settings';
import { Language } from './language';
import { Connection } from './connection';
import { Word } from './word';
import { WordsOfLanguage } from './words-of-language';

import 'rxjs/add/operator/toPromise';

class WordIn {
    w: string;
    cc: number;
    fcd: {y: number; m: number; d:number;};
    tr: string[];
    s: string;
    t: string;
}

class WordL {
    w: string;
    tr: string[];
    s: string;
    t: string;
}

class Ger {
    inProgress: WordIn[];
    learned: WordL[];
}

@Injectable()
export class DatabaseService {
    private urlToDatabase = '../../database/';    
    private settingsFileName = 'settings';
    private connectionsFileName = 'connections';
    private settingsUrl = this.urlToDatabase + this.settingsFileName + '.json';
    // private connectionsUrl = this.urlToDatabase + this.connectionsFileName + '.json';
    private connectionsUrl = this.urlToDatabase + this.connectionsFileName + "_n" + '.json';
    // private languageFileNames : string[]; // can do without(be local)
    private languageUrls : string[];

    private headers = new Headers({'Content-Type': 'application/json'});

    // private initHasBeenTriggered:boolean = false;
    private initPromise: Promise<any>;
    settings: Settings;
    wordsOfLanguages: WordsOfLanguage[]; // [lang]
    connections: Connection[][][]; // [lang from][lang to][index of connection]    

    private registeredTags: Promise<string[]>;

    constructor(private http: Http) {

    }

    // Load everything into memory.
    // This method will be called at application onInit()
    init(): Promise<any> {
        if (!this.initPromise) { // not null => has been initiated
            this.initPromise = Promise.all([
                    this.loadFromFile(this.connectionsUrl)
                        .then(json => this.connections = (json.langFromTo as Connection[][][])),
                    this.loadFromFile(this.settingsUrl)
                        .then(json => this.settings = (json as Settings)) // Now settings is ready
                        .then(() => { // Fill the languageUrls[] using settings' data
                            this.languageUrls = this.settings.languages.registeredLanguages
                                    .map(
                                        // language => (this.urlToDatabase + language.label + '.json')
                                        language => (this.urlToDatabase + language.label + "_n" + '.json')
                                    );
                        }) // Now languageUrls[] is ready
                        .then(() => { // Based on it now load wordsOfLanguages[]
                            this.wordsOfLanguages = []; // Init, so we can push later
                            // console.log('>> Database is being accessed');
                            return Promise.all( // Load them in parallel
                                // List of urls => list of promises
                                this.languageUrls.map((languageUrl, index) =>
                                    this.loadFromFile(languageUrl)
                                        .then(json => {
                                            this.wordsOfLanguages[index] = (json as WordsOfLanguage);
                                            this.wordsOfLanguages[index].words.map(word => word.w = this.decodeString(word.w));
                                        })
                                )
                            );
                        }) // Now wordsOfLanguages[] is ready
                ])
                .then(
                    () => this.updateRegisteredTags()
                )
                // .then((res) => {
                //     console.log('>> Everything is loaded!');                            
                // })
                .catch(this.handleError);
        }

        return this.initPromise;
    }        




    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=   DATABASE API   +=+=+=+=+=+=+=+=+=+=
    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=   DATABASE API   +=+=+=+=+=+=+=+=+=+=
    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=   DATABASE API   +=+=+=+=+=+=+=+=+=+=


    // +=+=+=+=+=+=   WORD   +=+=+=+=+=+=

    getWordById(languageIndex: number, id: number): Word {        
        return this.getById(id, this.wordsOfLanguages[languageIndex].words);
    }

    getWordByName(languageIndex: number, name: string): Word {
        return this.wordsOfLanguages[languageIndex].words.find(word => word.w == name);        
    }

    getWordIndexById(languageIndex: number, id: number): number {        
        return this.getIndexById(id, this.wordsOfLanguages[languageIndex].words);
    }

    getWordIndexByName(languageIndex: number, name: string): number {
        return this.wordsOfLanguages[languageIndex].words.findIndex(word => word.w == name);        
    }    

    getWordScore(languageIndex: number, wordIndex: number): number {
        return this.wordsOfLanguages[languageIndex].words[wordIndex].s;
    }

    setWordScore(languageIndex: number, wordIndex: number, score: number): void {
        this.wordsOfLanguages[languageIndex].words[wordIndex].s = score;
    }

    updateWordScore(languageIndex: number, wordIndex: number, scoreDelta: number): number {        
        const word: Word = this.wordsOfLanguages[languageIndex].words[wordIndex];
        word.s += scoreDelta;
        if (word.s < 0) {
            word.s = 0.0;
        }

        return word.s;
    }

    addWord(languageIndexFrom: number, languageIndexTo: number, 
        wordName: string, translations: string[], tags: string[]): number {
                
        return this.submitWord(languageIndexFrom, languageIndexTo, wordName, translations, tags);
    }
    
    editWord(languageIndexFrom: number, languageIndexTo: number, wordId: number,
        newWordName: string, translations: string[], tags: string[]): void {
        
        this.getWordById(languageIndexFrom, wordId).w = newWordName;
        this.submitWord(languageIndexFrom, languageIndexTo, newWordName, translations, tags);
    }

    // Removes the word entry and all connections to and from it FOR GIVEN LANGUAGE PAIR
    // (so if the words exists elsewhere as well, equivalent to only removing connections for given lang pair)
    // The words remains for other languages in the words database
    deleteWord(languageIndexFrom: number, languageIndexTo: number, wordIndex: number): void {        
        const wordId: number = this.wordsOfLanguages[languageIndexFrom].words[wordIndex].id;        
        const connectionIndex: number = this.getConnectionIndexByFromId(languageIndexFrom, languageIndexTo, wordId);
        if (connectionIndex < 0) {
            // This words doesn't have translations for given language pair.
            // If the user wants to remove this word, then he has to find the right lang pair
            return;
        }
        const connection: Connection = this.connections[languageIndexFrom][languageIndexTo][connectionIndex];

        // Remove connection from translations[] to the word
        connection.to            
            .forEach(translationWordId => {
                this.removeSingleConnection(languageIndexTo, languageIndexFrom, translationWordId, wordId);                
                this.removeWordIfNoConnectionsFrom(languageIndexTo, this.getWordIndexById(languageIndexTo, translationWordId));
            });

        // Remove connection from the word to translations[]
        this.removeConnectionEntry(connectionIndex, this.connections[languageIndexFrom][languageIndexTo]);

        // Remove the word itself if it is not needed in other langs
        this.removeWordIfNoConnectionsFrom(languageIndexFrom, wordIndex);
    }

    // return: id of the word, undefined otherwise        
    private submitWord(languageIndexFrom: number, languageIndexTo: number, 
        wordName: string, translations: string[], tags: string[], 
        joinInsteadOfReplace: boolean = false, depthLevel: number = 0): number {                    
        
        const wordIndex: number = this.getWordIndexByName(languageIndexFrom, wordName);
        const wordAlreadyExists = wordIndex >= 0;

        if (depthLevel >= 2) {
            // Then the word must exist in the database            
            // So just return its ID

            // The word is supposed to be already processed(nothing to change)
            // OR it will be handeled elsewhere immediately after

            if (!wordAlreadyExists) {
                console.error(">> WHY??????");
                return undefined;
            }            

            return this.wordsOfLanguages[languageIndexFrom].words[wordIndex].id;
        }        

        
        if (wordAlreadyExists) { // then join || rewrite            
            const wordId: number = this.wordsOfLanguages[languageIndexFrom].words[wordIndex].id;
            let forwardConnection: Connection = this.getConnectionByFromId(languageIndexFrom, languageIndexTo, wordId);

            // If the word doesn't have a connection for this pair of languages
            if (!forwardConnection) {
                const newLength: number = this.connections[languageIndexFrom][languageIndexTo].push(new Connection(wordId, []));
                forwardConnection = this.connections[languageIndexFrom][languageIndexTo][newLength - 1];
            }            

            if (joinInsteadOfReplace) { // join

                translations
                    .map(translation =>
                        this.submitWord(languageIndexTo, languageIndexFrom, translation, [wordName], tags, true, depthLevel + 1)
                    )
                    .forEach(translationId => this.addIfNotPresent(translationId, forwardConnection.to));

                tags.forEach(tag => this.addIfNotPresent(tag, this.getWordById(languageIndexFrom, wordId).t));

            } else { // replace
                                
                // Add all translations to the database(if needed) and return their IDs
                // It is here where we create new BACK CONNECTIONS t1->w, t2->w, ... to the given word
                const newTranslationIds: number[] = translations
                    .map(translation =>
                        this.submitWord(languageIndexTo, languageIndexFrom, translation, [wordName], tags, true, depthLevel + 1)
                    );

                // Need to remove all previous(old) BACK CONNECTIONS from each translation of this word
                forwardConnection.to
                    .filter(id => !newTranslationIds.includes(id)) // Leave only old IDs - need to remove only them
                    .forEach(wordIdToRemoveConnectionFor => {                        
                        this.removeSingleConnection(languageIndexTo, languageIndexFrom, wordIdToRemoveConnectionFor, wordId);
                        //The only connection left TO this word(from the given word) will be removed later
                        this.removeWordIfNoConnectionsFrom(languageIndexTo, 
                            this.getWordIndexById(languageIndexTo, wordIdToRemoveConnectionFor)); 
                    });

                // Now manage FORWARD CONNECTIONS w->t1, w->t2, ...
                forwardConnection.to = newTranslationIds;

                // Fill tags
                this.wordsOfLanguages[languageIndexFrom].words[wordIndex].t = tags;
            }

            return wordId;

        } else { // does not exist yet
            // so create a new entry (add)
            
            // Adding the new word to the database
            const newId: number = this.wordsOfLanguages[languageIndexFrom].nextIdToUse++;
            const startingScore: number = 0.0;
            const newWord: Word = new Word(newId, wordName, startingScore, tags);
            this.wordsOfLanguages[languageIndexFrom].words.push(newWord);

            // Now there exists the word entry in the database, so alreadyExists will == true
            return this.submitWord(languageIndexFrom, languageIndexTo, wordName, translations, tags, joinInsteadOfReplace, depthLevel);
        }
    }

    // Only removes the entry from the database. Does not do anything with connections
    private removeWordEntry(languageIndex: number, wordIndex: number): Word {
        return this.wordsOfLanguages[languageIndex].words.splice(wordIndex, 1)[0];
    }

    // Returns true if the word got removed
    // Assumes connections are two-way: if a->b exists, then b->a has to be present as well
    // Also removes empty connection entry FROM this word
    private removeWordIfNoConnectionsFrom(languageIndex: number, wordIndex: number): boolean {
        const wordId: number = this.wordsOfLanguages[languageIndex].words[wordIndex].id;
        const noConnections: boolean = 
            // For each language from the given language
            this.connections[languageIndex].every(languageConnections => {
                const soughtConnectionIndex: number = languageConnections.findIndex(connection => connection.from == wordId);
                return this.removeConnectionEntryIfEmpty(soughtConnectionIndex, languageConnections);                
            });

        // Remove the word
        if (noConnections) {
            this.removeWordEntry(languageIndex, wordIndex);
        }

        return noConnections;
    }




    // +=+=+=+=+=+=   CONNECTION   +=+=+=+=+=+=

    getConnectionByFromId(languageIndexFrom: number, languageIndexTo: number, fromId: number): Connection {
        return this.connections[languageIndexFrom][languageIndexTo].find(connection => connection.from == fromId);
    }

    getConnectionIndexByFromId(languageIndexFrom: number, languageIndexTo: number, fromId: number): number {
        return this.connections[languageIndexFrom][languageIndexTo].findIndex(connection => connection.from == fromId);
    }

    isConnectionEmpty(languageIndexFrom: number, languageIndexTo: number, fromId: number): boolean {
        const connection: Connection = this.getConnectionByFromId(languageIndexFrom, languageIndexTo, fromId);
        return (connection ? connection.to.length == 0 : true);
    }
    
    // Cleans the connection entry if it is empty after the removal
    // Removes a single a->b connection
    private removeSingleConnection(languageIndexFrom: number, languageIndexTo: number, 
        wordIdFrom: number, wordIdTo: number): void {

        // const wordIdFrom: number = this.wordsOfLanguages[languageIndexFrom].words[wordIndexFrom].id;
        // const wordIdTo: number = this.wordsOfLanguages[languageIndexTo].words[wordIndexTo].id;
        const connectionIndex: number = this.getConnectionIndexByFromId(languageIndexFrom, languageIndexTo, wordIdFrom);        
        const connection: Connection = this.connections[languageIndexFrom][languageIndexTo][connectionIndex];
        if (!connection) {            
            return;
        }

        const indexOfSoughtId: number = connection.to.indexOf(wordIdTo);            
        connection.to.splice(indexOfSoughtId, 1);

        this.removeConnectionEntryIfEmpty(connectionIndex, this.connections[languageIndexFrom][languageIndexTo]);        
    }

    // Remove the 'from and to[]' entry altogether    
    private removeConnectionEntry(connectionIndex: number, array: Connection[]): void {        
        array.splice(connectionIndex, 1);
    }

    // Returns true if the connection got removed or it was not present at all
    private removeConnectionEntryIfEmpty(connectionIndex: number, array: Connection[]):boolean {
        const connection: Connection = array[connectionIndex];

        if (connection) {
            if (connection.to.length == 0) {                
                this.removeConnectionEntry(connectionIndex, array);
                return true;
            } else {
                return false;
            }            
        }

        return true;
    }



    // +=+=+=+=+=+=   TAG   +=+=+=+=+=+=

    getRegisteredTags(): Promise<string[]> {
        return this.registeredTags;
    }

    private updateRegisteredTags(): void {
        this.registeredTags = Promise.resolve(
            this.wordsOfLanguages
                .map((wordsOfLanguage) => wordsOfLanguage.words) // get words[] for every language
                .reduce((arrays, array) => arrays.concat(array), []) // concat all words[]
                .map(word => word.t) // retrieve tags from words
                .reduce((allTags, tags) => allTags.concat(tags), []) // concat all tags[]
                .reduce((accTags, tag) => { // keep unique
                    if (!accTags.includes(tag)) {
                        accTags.push(tag);
                    }

                    return accTags;
                }, [])
        );        
    }

    
    // +=+=+=+=+=+=   GENERAL   +=+=+=+=+=+=

    // Tries to guess, not do a bruteforce search
    // Assumes the ids are sorted
    getIndexById(id: number, array: any[]): number {                
        if (array.length < 10) {
            return array.findIndex(element => element.id == id);
        }
        // Else

        let index: number = id;
        
        // Step back if we're out of bounds
        while (array[index] == undefined) {
            index--;

            if (index < 0) {
                return -1;
            }
        }        

        // Now we're inside the array for sure
        // Just look for the sought id
        while (array[index].id > id) {
            index--;

            if (index < 0) {
                return -1;
            }
        }

        // Could be < that sought id
        return (array[index].id == id) ? index : -1;
    }

    // TODO: mb use getIndexById() if it prooves useful
    getById(id: number, array: any[]): any {
        return array.find(element => element.id == id);
    }

    // Returns true if the value was not present before
    addIfNotPresent(value: any, array: any[]): boolean {
        if (!array.includes(value)) {
            array.push(value);
            return true;
        }

        return false;
    }


    // // NEEDED ???
    // private isSubset(a: any[], b: any[], exact: boolean) {
    //     if (exact) {
    //         if (a.length != b.length) {
    //             return false;
    //         }
    //     }
        
    //     a.forEach(value => {
    //         if (!b.includes(value)) {
    //             return false;
    //         }
    //     });

    //     return true;
    // }
    

    
    // +=+=+=+=+=+=   GET   LANGUAGE   +=+=+=+=+=+=

    getLanguage(index: number): Language {        
        return this.settings.languages.registeredLanguages[index];
    }

    getLanguageByName(name: string): Language {
        return this.settings.languages.registeredLanguages.find(language => language.name == name);
    }

    getLanguageByLabel(label: string): Language {
        return this.settings.languages.registeredLanguages.find(language => language.label == label);
    }

    getLanguageIndexByName(name: string): number {
        return this.settings.languages.registeredLanguages.findIndex(language => language.name == name);
    }

    getLanguageIndexByLabel(label: string): number {
        return this.settings.languages.registeredLanguages.findIndex(language => language.label == label);
    }

    getLanguages(): Language[] {
        return this.settings.languages.registeredLanguages;
    }
    
   






    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=


    saveProgress():void {
        this.saveToDatabase();
    }

    private saveToDatabase(): Promise<string[]> {
        return Promise.all([
                this.saveToFile(this.settingsUrl, this.settings),                
                this.saveToFile(this.connectionsUrl, {"langFromTo": this.connections}),                
                Promise.all( 
                    // List of urls => list of promises
                    this.languageUrls.map((languageUrl, index) => {                        
                        this.wordsOfLanguages[index].words.map(word => word.w = this.encodeString(word.w));
                        this.saveToFile(languageUrl, this.wordsOfLanguages[index]);
                        this.wordsOfLanguages[index].words.map(word => word.w = this.decodeString(word.w));
                    })
                )
            ])
            .catch(this.handleError);
    }

    private loadFromFile(url: string): Promise<any> {
        return this.http.get(url)
                        .toPromise()
                        .then(response => response.json())
                        .catch(this.handleError);
    }

    private saveToFile(url: string, content: any): Promise<any> {
        return this.http.post(url, JSON.stringify(content), {headers: this.headers})
                        .toPromise()
                        // .then()
                        .catch(this.handleError);
    }
    

    private handleError(error: any): Promise<any> {
        console.error('>> Error in DatabaseService:', error);
        return Promise.reject(error.message || error);
    } 

    private encodeChar(char: string): string {        
        // German
        switch(char.charAt(0)) {
            case 'ü':
                return ';u';                
            case 'ä':
                return ';a';                
            case 'ö':
                return ';o';                
            case 'ß':
                return ';s';
            default:
                break;
        }

        // Rus, Ukr     
        const charCode: number = char.charCodeAt(0);   

        const lowest: number = 1072; // Rus letter 'a'
        const highest: number = 1111; // Ukr letter 'i' with two dots
        const dec: number = lowest;
        const shift: number = 10; // to get two digits

        // Rus && Ukr
        if (charCode >= lowest && charCode <= highest) {
            return ";" + (charCode - dec + shift); 
        } else {
            return char; // Leave as is
            // return ";??"
        }
    } 

    private encodeString(str: string): string {
        let res: string = "";

        for (let char of str) {            
            res += this.encodeChar(char);
        }

        return res;
    }

    private decodeString(str: string): string {
        let res: string = "";        

        const lowest: number = 1072; // Rus letter 'a'
        const highest: number = 1111; // Ukr letter 'i' with two dots
        const inc: number = lowest;
        const shift: number = 10; // to get two digits

        for (let i = 0; i < str.length; i++) {
            let char: string = str.charAt(i);

            if (char == ';') {        
                if (this.isDigit(str.charAt(i + 1)) && this.isDigit(str.charAt(i + 2))) { // Rus || Ukr
                    let theNumber: number = +str.charAt(i + 1) * 10 + +str.charAt(i + 2);

                    const charCode = theNumber + inc - shift;
                    if (charCode >= lowest && charCode <= highest) {
                        char = String.fromCharCode(charCode);
                    } else {
                        char = '?';
                    }

                    i += 2;
                } else { // Ger
                    switch(str.charAt(i + 1)) {
                        case 'u':
                            char = 'ü';
                            break;
                        case 'a':
                            char = 'ä';
                            break;
                        case 'o':
                            char = 'ö';
                            break;
                        case 's':
                            char = 'ß';
                            break;
                        default:
                            char = '?';
                    }

                    i += 1;
                }                
            }

            res += char;
        }

        return res;
    }

    private isDigit(char: string): boolean {
        const code = char.charCodeAt(0);
        return (code >= 48 && code <= 57);
    }

    translateOldDatabase(): void {
        let wordsGer: WordsOfLanguage = new WordsOfLanguage();
        let wordsEng: WordsOfLanguage = new WordsOfLanguage();
        let wordsRus: WordsOfLanguage = new WordsOfLanguage();
        let conn: Connection[][][] = [];        

        this.loadFromFile(this.urlToDatabase + "words" + ".json")
            .then(json => json as Ger)
            .then(ger => {                
                wordsGer.words = [];
                wordsEng.words = [];
                wordsRus.words = [];
                conn.push([[], [], []]);
                conn.push([[], [], []]);
                conn.push([[], [], []]);
                conn[0][0] = [];
                conn[0][1] = []; // Ger -> Eng
                conn[0][2] = [];
                conn[1][0] = []; // Eng -> Ger
                conn[1][1] = [];
                conn[1][2] = [];
                conn[2][0] = []; // From rus
                conn[2][1] = []; // From rus
                conn[2][2] = []; // From rus

                wordsGer.nextIdToUse = 0;
                wordsEng.nextIdToUse = 0;
                wordsRus.nextIdToUse = 0;

                ger.inProgress.reverse().map(wordGer => {
                    const gerId: number = wordsGer.nextIdToUse++;
                    let newGerWord: Word = new Word(gerId, wordGer.w, 1.0 * wordGer.cc, [wordGer.t]);
                    wordsGer.words.push(newGerWord);
                   
                    conn[0][1].push(new Connection(gerId, []));

                    wordGer.tr.forEach(engWordStr => {
                        let engWord: Word = wordsEng.words.find(word => word.w == engWordStr);
                        if (engWord) {                            
                            // Word itself
                            engWord.s = Math.round((engWord.s + 1.0 * wordGer.cc) / 2.0 * 100.0) / 100.0;
                            if (!engWord.t.includes(wordGer.t)) {
                                engWord.t.push(wordGer.t);
                            }

                            // connections
                            conn[1][0].find(connection => connection.from == engWord.id).to.push(gerId);
                            conn[0][1].find(connection => connection.from == gerId).to.push(engWord.id);
                        } else {
                            const id: number = wordsEng.nextIdToUse++;
                            engWord = new Word(id, engWordStr, +(Math.floor(1.0 * wordGer.cc * 0.75 * 100.0) / 100.0).toFixed(2), [wordGer.t]);
                            wordsEng.words.push(engWord);

                            // connections
                            conn[1][0].push(new Connection(id, [gerId]));
                            conn[0][1].find(connection => connection.from == gerId).to.push(id);
                        }
                    });                    
                });

                ger.learned.reverse().map(wordGer => {
                    const scoreToSet: number = 25.0;
                    const gerId: number = wordsGer.nextIdToUse++;                    
                    let newGerWord: Word = new Word(gerId, wordGer.w, scoreToSet, [wordGer.t]);
                    wordsGer.words.push(newGerWord);
                   
                    conn[0][1].push(new Connection(gerId, []));

                    wordGer.tr.forEach(engWordStr => {
                        let engWord: Word = wordsEng.words.find(word => word.w == engWordStr);
                        if (engWord) {                            
                            // Word itself
                            engWord.s = +(Math.floor((engWord.s + scoreToSet - 5.0) / 2.0 * 100.0) / 100.0).toFixed(2);
                            if (!engWord.t.includes(wordGer.t)) {
                                engWord.t.push(wordGer.t);
                            }

                            // connections
                            conn[1][0].find(connection => connection.from == engWord.id).to.push(gerId);
                            conn[0][1].find(connection => connection.from == gerId).to.push(engWord.id);
                        } else {
                            const id: number = wordsEng.nextIdToUse++;
                            engWord = new Word(id, engWordStr, scoreToSet - 5.0, [wordGer.t]);
                            wordsEng.words.push(engWord);

                            // connections
                            conn[1][0].push(new Connection(id, [gerId]));
                            conn[0][1].find(connection => connection.from == gerId).to.push(id);
                        }
                    });                    
                });
            })
            .then(() => {
                Promise.all([
                    this.saveToFile(this.urlToDatabase + "rus_n" + ".json", wordsRus).then(() => {}),
                    this.saveToFile(this.urlToDatabase + "eng_n" + ".json", wordsEng).then(() => {}),
                    this.saveToFile(this.urlToDatabase + "ger_n" + ".json", wordsGer).then(() => {}),
                    this.saveToFile(this.urlToDatabase + "connections_n" + ".json", {"langFromTo": conn}).then(() => {})
                ])
                .catch(this.handleError);
            })
            .catch(this.handleError);
    }
}
