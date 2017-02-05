import { Injectable } from '@angular/core';
import { Headers, Http, RequestOptions } from '@angular/http';
// import {Http, Response, Headers, RequestOptions} from "@angular/http";

import { Settings } from './settings';
import { Language } from './language';
import { Connection } from './connection';
import { Word } from './word';
import { WordsOfLanguage } from './words-of-language';
import { OldDatabaseLoader } from './old-database-loader';

import 'rxjs/add/operator/toPromise';

@Injectable()
export class DatabaseService {
    private urlToDatabase = '../../database/';
    private settingsFileName = 'settings';
    private connectionsFileName = 'connections';
    private settingsUrl = this.urlToDatabase + this.settingsFileName + '.json';
    // private connectionsUrl = this.urlToDatabase + this.connectionsFileName + '.json';
    private connectionsUrl = this.urlToDatabase + this.connectionsFileName + "_n" + '.json';
    private languageUrls: string[];

    private fileHeaders = new Headers({ 'Content-Type': 'application/json' });
    private initPromise: Promise<any>;

    // 'private' implies that this class is responsible for listening to the changes
    // and dumping them to the filesystem when necessary. Otherwise dumped always immediately
    settings: Settings;
    wordsOfLanguages: WordsOfLanguage[]; // [lang]
    connections: Connection[][][]; // [lang from][lang to][index of connection]    

    registeredTags: string[] = [];
    registeredTagsAmount: number[] = [];
    tagsToUse: string[] = [];

    constructor(private http: Http) {

    }

    /**
     * Load everything into memory.
     * This method will be called at application onInit().
     */
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
                .then(() => {
                    this.updateRegisteredTags();
                    this.useAllTags();
                })
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
        word.s = this.round(word.s + scoreDelta);
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

    /**
     * Removes the word entry and all connections to and from it FOR GIVEN LANGUAGE PAIR.
     * (so if the words exists elsewhere as well, equivalent to only removing connections for given lang pair).
     * The words remains for other languages in the words database.
     */
    deleteWord(languageIndexFrom: number, languageIndexTo: number, wordIndex: number): void {
        const wordId: number = this.wordsOfLanguages[languageIndexFrom].words[wordIndex].id;
        const connectionIndex: number = this.getConnectionIndexByFromId(languageIndexFrom, languageIndexTo, wordId);
        if (connectionIndex == undefined || connectionIndex < 0) {
            // This words doesn't have translations for given language pair.
            // If the user wants to remove this word, then he has to find the right lang pair
            return;
        }
        const connection: Connection = this.connections[languageIndexFrom][languageIndexTo][connectionIndex];

        // Remove connection from translations[] to the word
        connection.to
            .forEach(translationWordId => {
                this.removeSingleConnection(languageIndexTo, languageIndexFrom, translationWordId, wordId);
                const translationIndex: number = this.getWordIndexById(languageIndexTo, translationWordId);
                const gotRemoved: boolean =
                    this.removeWordIfNoConnectionsFrom(languageIndexTo, translationIndex);

                if (!gotRemoved) {
                    const translation: Word = this.wordsOfLanguages[languageIndexTo].words[translationIndex];
                    const tagsForTranslation: string[] = this.collectTagsForWord(languageIndexTo, translationWordId);
                    translation.t = translation.t.filter(tag => tagsForTranslation.includes(tag));
                }
            });

        // Remove connection from the word to translations[]
        this.removeConnectionEntry(connectionIndex, this.connections[languageIndexFrom][languageIndexTo]);

        // Remove the word itself if it is not needed in other langs
        this.removeWordIfNoConnectionsFrom(languageIndexFrom, wordIndex);
    }

    /** 
     * In theory, joinInsteadOfReplace == false (and depth == 0) when altering the db from the outside,
     * and joinInsteadOfReplace == true (and depth == 1) when submitting translations(db is altered from the inside).
     * Returns id of the word, undefined Otherwise.     
     */
    private submitWord(languageIndexFrom: number, languageIndexTo: number,
        wordName: string, translations: string[], tags: string[],
        joinInsteadOfReplace: boolean = false, depthLevel: number = 0): number {

        const wordIndex: number = this.getWordIndexByName(languageIndexFrom, wordName);
        const wordAlreadyExists = (wordIndex != undefined) && (wordIndex != -1);

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
            const word: Word = this.wordsOfLanguages[languageIndexFrom].words[wordIndex];
            const wordId: number = word.id;
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

                const tagsForWord: string[] = this.collectTagsForWord(languageIndexFrom, wordId);
                word.t = word.t.filter(tag => tagsForWord.includes(tag));
                tags.forEach(tag => this.addIfNotPresent(tag, word.t));

            } else { // replace

                // Done before the translations submitting, 
                // because the latter one will rely upon proper tags of this word(when executing collectTags())
                word.t = tags;

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

    /**
     * Only removes the entry from the database. Does not do anything with connections.
     */
    private removeWordEntry(languageIndex: number, wordIndex: number): Word {
        return this.wordsOfLanguages[languageIndex].words.splice(wordIndex, 1)[0];
    }

    /**     
     * Assumes connections are two-way: if a->b exists, then b->a has to be present as well.     
     * Also removes empty connection entry FROM this word.     
     * Returns true if the word got removed.
     */
    private removeWordIfNoConnectionsFrom(languageIndex: number, wordIndex: number): boolean {
        const wordId: number = this.wordsOfLanguages[languageIndex].words[wordIndex].id;
        const noConnections: boolean =
            // For each language from the given language
            this.connections[languageIndex].every(languageConnections => {
                const soughtConnectionIndex: number = languageConnections.findIndex(connection => connection.from == wordId);
                // if soughtConnectionIndex == undefined || -1 (no connection ecntry exists)
                // then the next line will just return true(works OK)
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

    /**
     * Cleans the connection entry if it is empty after the removal.
     * Removes a single a->b connection.
     */
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
        if (indexOfSoughtId < 0) {
            return;
        }

        connection.to.splice(indexOfSoughtId, 1);

        this.removeConnectionEntryIfEmpty(connectionIndex, this.connections[languageIndexFrom][languageIndexTo]);
    }

    /**
     * Remove the 'from and to[]' entry altogether.
     */
    private removeConnectionEntry(connectionIndex: number, array: Connection[]): void {
        array.splice(connectionIndex, 1);
    }

    /**
     * Returns true if the connection had zero length or it was not present at all.
     */
    private removeConnectionEntryIfEmpty(connectionIndex: number, array: Connection[]): boolean {
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

    // getRegisteredTags(): string[] {
    //     return this.registeredTags;
    // }

    renameAllTagOccurences(oldTagName: string, newTagName: string): void {
        if (oldTagName == newTagName) {
            return;
        }

        if (!this.registeredTags.includes(oldTagName)) {
            return;
        }        

        const oldTagIndex: number = this.registeredTags.findIndex(tag => tag == oldTagName);
        if (this.registeredTags.includes(newTagName)) {            
            this.registeredTags.splice(oldTagIndex, 1);
        } else {
            this.registeredTags[oldTagIndex] = newTagName;
        }

        // Go through all words and change tags
        this.wordsOfLanguages
            .map(language => language.words)
            .forEach(wordsOfLanguage =>
                wordsOfLanguage
                    .map(word => word.t)
                    .forEach(tagsOfWord => {
                        let foundNew: boolean = false;

                        tagsOfWord.forEach((tag, index) => {
                            switch (tag) {
                                case oldTagName:
                                    tagsOfWord[index] = newTagName;                                
                                case newTagName: 
                                    if (foundNew) {
                                        tagsOfWord.splice(index, 1);
                                    }
                                    foundNew = true;                                
                            }
                        })
                    })
            )
    }

    useAllTags(): void {
        this.tagsToUse = [];
        this.registeredTags.forEach(tag => this.tagsToUse.push(tag));
    }

    /**
     * Collects all tags from the whole database
     */
    private updateRegisteredTags(): void {
        // this.registeredTags = Promise.resolve(
        this.registeredTags =
            this.wordsOfLanguages
                .map((wordsOfLanguage) => wordsOfLanguage.words) // get words[] for every language
                .reduce((arrays, array) => arrays.concat(array), []) // concat all words[]
                .map(word => word.t) // retrieve tags from words
                .reduce((allTags, tags) => allTags.concat(tags), []) // concat all tags[]
                .reduce((accTags, tag) => { // keep unique
                    const indexOfTag: number = accTags.findIndex(t => t == tag);

                    if (indexOfTag == undefined || indexOfTag == -1) {
                        accTags.push(tag);
                        this.registeredTagsAmount.push(0);
                    }

                    this.registeredTagsAmount[indexOfTag]++;

                    return accTags;
                }, []);
        // );
    }

    // Supposed to be executed only for translations
    private collectTagsForWord(languageIndex: number, wordId: number): string[] {
        return this.connections[languageIndex]
            .map(languageConnections => languageConnections.find(connection => connection.from == wordId))
            .map(connection => connection == undefined ? [] : connection.to)
            .map((translationIds, langIndex) =>
                translationIds
                    .map(translationId => this.getWordById(langIndex, translationId).t)
                    .reduce((accTags, tags) => accTags.concat(tags), [])
            )
            .reduce((allTags, tagsFromLanguage) => {
                tagsFromLanguage.forEach(tag => this.addIfNotPresent(tag, allTags));
                return allTags;
            }, []);
    }


    // +=+=+=+=+=+=   GENERAL   +=+=+=+=+=+=

    // Tries to guess, not do a bruteforce search
    // Assumes the ids are sorted    
    getIndexById(id: number, array: any[]): number {
        if (!array) {
            return undefined;
        }

        if (array.length < 10) {
            return array.findIndex(element => element.id == id);
        }
        // Else

        let index: number = id;

        // Step back if we're out of bounds
        while (array[index] == undefined) {
            index--;

            if (index < 0) {
                return undefined;
            }
        }

        // Now we're inside the array for sure
        // Just look for the sought id
        while (array[index].id > id) {
            index--;

            if (index < 0) {
                return undefined;
            }
        }

        // Could be < that sought id
        return (array[index].id == id) ? index : undefined;
    }

    // TODO: mb use getIndexById() if it prooves useful
    getById(id: number, array: any[]): any {
        return array ? array.find(element => element.id == id) : undefined;
    }

    // Returns true if the value was not present before
    addIfNotPresent(value: any, array: any[]): boolean {
        if (array) {
            if (!array.includes(value)) {
                array.push(value);
                return true;
            }
        }

        return false;
    }

    isIndexValid(array: any[], index: number): boolean {
        if (!array) {
            return false;
        }

        return (index >= 0 && index < array.length);
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

    isLanguageIndexValid(index: number): boolean {
        return this.isIndexValid(this.settings.languages.registeredLanguages, index);
    }








    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=


    saveProgress(): void {
        this.saveToDatabase();
    }

    private saveToDatabase(): Promise<string[]> {
        return Promise.all([
            this.saveToFile(this.settingsUrl, this.settings),
            this.saveToFile(this.connectionsUrl, { "langFromTo": this.connections }),
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
        return this.http.post(url, JSON.stringify(content), { headers: this.fileHeaders })
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
        switch (char.charAt(0)) {
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
                    switch (str.charAt(i + 1)) {
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

    round(x: number): number {
        return +(Math.floor(x * 100.0) / 100.0).toFixed(2);
    }

    translateOldDatabase(): void {
        this.loadFromFile(this.urlToDatabase + "words" + ".json")
            .then(json => new OldDatabaseLoader(json))
            .then(oldDbLoader => {
                Promise.all([
                    this.saveToFile(this.urlToDatabase + "rus_n" + ".json", oldDbLoader.getWordsRus()).then(() => { }),
                    this.saveToFile(this.urlToDatabase + "eng_n" + ".json", oldDbLoader.getWordsEng()).then(() => { }),
                    this.saveToFile(this.urlToDatabase + "ger_n" + ".json", oldDbLoader.getWordsGer()).then(() => { }),
                    this.saveToFile(this.urlToDatabase + "connections_n" + ".json",
                        { "langFromTo": oldDbLoader.getConnections() }).then(() => { })
                ])
                    .catch(this.handleError);
            })
            .catch(this.handleError);
    }
}
