import { Injectable } from '@angular/core';
import { Headers, Http, RequestOptions } from '@angular/http';
// import {Http, Response, Headers, RequestOptions} from "@angular/http";

import { Settings } from './settings';
import { Language } from './language';
import { Connection } from './connection';
import { Word } from './word';
import { WordsOfLanguage } from './words-of-language';

import 'rxjs/add/operator/toPromise';

@Injectable()
export class DatabaseService {
    private urlToDatabase = '../../database/';
    private settingsFileName = 'settings';
    private connectionsFileName = 'connections';
    private settingsUrl = this.urlToDatabase + this.settingsFileName + '.json';
    private connectionsUrl = this.urlToDatabase + this.connectionsFileName + '.json';
    private languageFileNames : string[]; // can do without(be local)
    private languageUrls : string[];

    private headers = new Headers({'Content-Type': 'application/json'});

    // private initHasBeenTriggered:boolean = false;
    private initPromise: Promise<any>;
    settings: Settings;
    wordsOfLanguages: WordsOfLanguage[]; // [lang]
    connections: Connection[][][]; // [lang from][lang to][index of connection]    

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
                                        language => (this.urlToDatabase + language.label + '.json')
                                    );
                        }) // Now languageUrls[] is ready
                        .then(() => { // Based on it now load wordsOfLanguages[]
                            this.wordsOfLanguages = []; // Init, so we can push later
                            console.log('>> Database is being accessed');
                            return Promise.all( // Load them in parallel
                                // List of urls => list of promises
                                this.languageUrls.map(languageUrl =>
                                    this.loadFromFile(languageUrl)
                                        .then(json =>
                                            this.wordsOfLanguages.push(json as WordsOfLanguage)
                                        )
                                )
                            );
                        }) // Now wordsOfLanguages[] is ready
                ])
                // .then((res) => {
                //     console.log('>> Everything is loaded!');                            
                // })
                .catch(this.handleError);
        }

        return this.initPromise;
    }

    private loadFromFile(url: string): Promise<any> {
        return this.http.get(url)
                        .toPromise()
                        .then(response => response.json())
                        .catch(this.handleError);
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
            const newId: number = ++this.wordsOfLanguages[languageIndexFrom].lastUsedId;
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
    
   






    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=


    // saveToDatabase(words: string[]): Promise<string[]> {
    //     const url = this.urlToDatabase + this.wordsFileName;
    //     // const url = '${this.url}/${hero.id}';
    //     return this.http
    //         // .post('http://localhost:8089/database/wordsMy.json', JSON.stringify({"some": words}), {headers: this.headers})
    //         .post(url, JSON.stringify({"some": words}), {headers: this.headers})
    //         // .post('../../database/wordsNew.json', JSON.stringify(words), new RequestOptions({ headers: this.headers }))
    //         .toPromise()
    //         .then(() => words)
    //         // .then(res => res.json())
    //         .catch(this.handleError);
    // }
    //

    private handleError(error: any): Promise<any> {
        console.error('>> Error in service:', error);
        return Promise.reject(error.message || error);
    }
}
