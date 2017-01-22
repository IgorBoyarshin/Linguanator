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

    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=
    // +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=

    
    // Who calls: 
    // - component when submitting a new word
    // - db when ???
    addWord(languageIdFrom: number, languageIdTo: number, 
        wordName: string, translations: string[], tags: string[]): number {
                
        return this.submitWord(languageIdFrom, languageIdTo, wordName, translations, tags);

        // const alreadyExists: boolean = this.wordsOfLanguages[languageIdFrom].words.findIndex(word => word.w == wordName) >= 0;        
        // if (alreadyExists) {
        //     return; // TODO: MB change 
        // }

        // // Adding the new word to the database
        // const newId: number = this.wordsOfLanguages[languageIdFrom].lastUsedId++;
        // const startingScore: number = 0.0;
        // const newWord: Word = new Word(newId, wordName, startingScore, tags);
        // this.wordsOfLanguages[languageIdFrom].words.push(newWord);

    }

    // Who calls:
    // - component when submitting an edited word
    editWord(languageIdFrom: number, languageIdTo: number, id: number,
        wordName: string, translations: string[], tags: string[]): void {
        

    }


    // Who calls:
    // - db when processing translations
    // return: id of the word
    private submitWord(languageIdFrom: number, languageIdTo: number, 
        wordName: string, translations: string[], tags: string[], joinInsteadOfReplace: boolean = false, 
        depthLevel: number = 0): number {
                
        // console.log(" ".repeat(depthLevel * 3) + ">> Called for(" + depthLevel + "): " + wordName + "; with " + translations.join(", "));

        const wordIndex: number = this.wordsOfLanguages[languageIdFrom].words.findIndex(word => word.w == wordName);
        const alreadyExists = wordIndex >= 0;

        if (depthLevel >= 2) {
            // Then the word must exist and must be self-contained(nothing to change in it)            

            if (!alreadyExists) {
                console.error(">> WHY??????");
                return undefined;
            }

            console.log(" ".repeat(depthLevel * 3) + ">> Called for(" + depthLevel + "): " 
                    + wordName + "; with [" + translations.join(", ") + "]");
            console.log(" ".repeat(depthLevel * 3) + ">> Returning(" + depthLevel + ") id for " + wordName);

            return this.wordsOfLanguages[languageIdFrom].words[wordIndex].id;
        }

        
        if (alreadyExists) { // then join || rewrite
            // wordId and wordIndex exist and are valid for sure

            const wordId: number = this.wordsOfLanguages[languageIdFrom].words[wordIndex].id;                    

            if (joinInsteadOfReplace) { // join
                console.log(" ".repeat(depthLevel * 3) + ">> Called for(" + depthLevel + "): " 
                    + wordName + "; with [" + translations.join(", ") + "] with join");                

                translations
                    .map(translation => {
                        // Will just return the id of the initial word, thus stopping the recursion
                        const id = this.submitWord(languageIdTo, languageIdFrom, translation, [wordName], tags, true, depthLevel + 1);                        

                        return id;
                    })
                    // Now add only those ids that are not there yet
                    // (supposed to be just one for the initial word)
                    .map(id => {
                        const connectionIndex: number = 
                            this.connections[languageIdFrom][languageIdTo].findIndex(connection => connection.from == wordId);

                        if (!this.connections[languageIdFrom][languageIdTo][connectionIndex].to.includes(id)) {
                            this.connections[languageIdFrom][languageIdTo][connectionIndex].to.push(id);
                        }
                    });

                // if (!somethingChanged) {
                //     return undefined; // TODO !!!
                // }


                // Tags              
                // Tags are done after translations[] because if nothing changed then we've already exited up there
                tags.map(tag => {
                    if (!this.wordsOfLanguages[languageIdFrom].words[wordIndex].t.includes(tag)) {
                        this.wordsOfLanguages[languageIdFrom].words[wordIndex].t.push(tag);
                        // somethingChanged = true;
                    }
                });

                // return wordId;

            } else { // replace
                console.log(" ".repeat(depthLevel * 3) + ">> Called for(" + depthLevel + "): " 
                    + wordName + "; with [" + translations.join(", ") + "] with replace");
                // let returnedUndefined: boolean = false;

                const connectionIndex: number = 
                            this.connections[languageIdFrom][languageIdTo].findIndex(connection => connection.from == wordId);
                                
                const newIds: number[] = translations
                    .map(translation => {
                        const id = this.submitWord(languageIdTo, languageIdFrom, translation, [wordName], tags, true, depthLevel + 1);
                        // if (!id) { // not undefined
                        //     somethingChanged = true;
                        // }

                        return id;
                    });

                // Need to remove all previous connections from the words of translations
                this.connections[languageIdFrom][languageIdTo][connectionIndex].to
                    .forEach(idToRemoveConnectionFor => {
                        if (!newIds.includes(idToRemoveConnectionFor)) { // Then this id is no more => remove it
                            const indexOfId: number = this.connections[languageIdTo][languageIdFrom]
                                .findIndex(connection => connection.from == idToRemoveConnectionFor);
                            
                            this.connections[languageIdTo][languageIdFrom][indexOfId].to
                                .splice(this.connections[languageIdTo][languageIdFrom][indexOfId].to.findIndex(id => id == wordId), 1);

                            // TODO: check if safe to do this
                            // this.removeWordIfItHasNoConnections(languageIdTo, idToRemoveConnectionFor);
                        }
                    });

                this.connections[languageIdFrom][languageIdTo][connectionIndex].to = newIds;

                                



                this.wordsOfLanguages[languageIdFrom].words[wordIndex].t = tags;

                // Valid id of the word we've finished processing 
                // return wordId;

            }

            console.log(" ".repeat(depthLevel * 3) + ">> Returning(" + depthLevel + ") id for " + wordName);
            console.log("");
            return wordId;
        } else { // then create new (add)
            
            // Adding the new word to the database
            const newId: number = this.wordsOfLanguages[languageIdFrom].lastUsedId++;
            const startingScore: number = 0.0;
            const newWord: Word = new Word(newId, wordName, startingScore, tags);
            this.wordsOfLanguages[languageIdFrom].words.push(newWord);


            return this.submitWord(languageIdFrom, languageIdTo, wordName, translations, tags);
        }

        // return word
    }

    private isSubset(a: any[], b: any[], exact: boolean) {
        if (exact) {
            if (a.length != b.length) {
                return false;
            }
        }
        
        a.forEach(value => {
            if (!b.includes(value)) {
                return false;
            }
        });

        return true;
    }

    // If a word does not exist => its id == undefined
    private mapWordsNamesToIds(languageId: number, wordsNames: string[]): number[] {
        return wordsNames.map(wordName => this.wordsOfLanguages[languageId].words.find(word => word.w == wordName).id);        
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

    // Removes the word entry and all connections to and from it for given language pair
    deleteWord(languageIndexFrom: number, languageIndexTo: number, wordIndex: number): Word {        
        const wordId: number = this.wordsOfLanguages[languageIndexFrom].words[wordIndex].id;
        const connection: Connection = this.getConnectionByFromId(languageIndexFrom, languageIndexTo, wordId);
        const connectionIndex: number = this.getConnectionIndexByFromId(languageIndexFrom, languageIndexTo, wordId);

        // Remove connection from translations[] to the word
        connection.to
            // .map(id => this.getWordIndexById(languageIndexTo, id))
            // .map(tr => {
            //     console.log(this.wordsOfLanguages[languageIndexTo].words[tr].w);
            //     return tr;
            // })
            .forEach(translationWordId => {
                this.removeConnection(languageIndexTo, languageIndexFrom, translationWordId, wordId);                
                this.removeWordIfNoConnectionsFrom(languageIndexTo, this.getWordIndexById(languageIndexTo, translationWordId));
            });

        // Remove connection from the word to translations[]
        this.removeConnectionEntry(connectionIndex, this.connections[languageIndexFrom][languageIndexTo]);

        // Remove the word itself
        return this.removeWordEntry(languageIndexFrom, wordIndex);
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
            console.log(">> Gonna remove " + this.wordsOfLanguages[languageIndex].words[wordIndex].w);
            this.removeWordEntry(languageIndex, wordIndex);
        }

        return noConnections;
    }




    // +=+=+=+=+=+=   CONNECTION   +=+=+=+=+=+=

    private getConnectionByFromId(languageIndexFrom: number, languageIndexTo: number, fromId: number): Connection {
        return this.connections[languageIndexFrom][languageIndexTo].find(connection => connection.from == fromId);
    }

    private getConnectionIndexByFromId(languageIndexFrom: number, languageIndexTo: number, fromId: number): number {
        return this.connections[languageIndexFrom][languageIndexTo].findIndex(connection => connection.from == fromId);
    }
    
    // Cleans the connection entry if it is empty after the removal
    private removeConnection(languageIndexFrom: number, languageIndexTo: number, 
        wordIdFrom: number, wordIdTo: number): void {

        // const wordIdFrom: number = this.wordsOfLanguages[languageIndexFrom].words[wordIndexFrom].id;
        // const wordIdTo: number = this.wordsOfLanguages[languageIndexTo].words[wordIndexTo].id;
        const connectionIndex: number = this.getConnectionIndexByFromId(languageIndexFrom, languageIndexTo, wordIdFrom);        
        const connection: Connection = this.connections[languageIndexFrom][languageIndexTo][connectionIndex];
        if (!connection) {
            console.error(">> Could not find connection for " + wordIdFrom + " -> " + wordIdTo);
            return;
        }

        const indexOfSoughtId: number = connection.to.indexOf(wordIdTo);            
        connection.to.splice(indexOfSoughtId, 1);

        this.removeConnectionEntryIfEmpty(connectionIndex, this.connections[languageIndexFrom][languageIndexTo]);
        console.log(">> Remove normal normal ");
    }

    // Remove the 'from and to[]' entry altogether    
    private removeConnectionEntry(connectionIndex: number, array: Connection[]): void {
        console.log(">> Remove eltogether");
        array.splice(connectionIndex, 1);
    }

    // Returns true if the connection got removed or it was not present at all
    private removeConnectionEntryIfEmpty(connectionIndex: number, array: Connection[]):boolean {
        const connection: Connection = array[connectionIndex];

        if (connection) {
            if (connection.to.length == 0) {
                console.log(">> Remove empty");
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
