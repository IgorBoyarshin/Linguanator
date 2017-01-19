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
                //             console.log('>> Everything is loaded!');
                //         })
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

    getLanguageIndexByLabel(label: string):number {        
        return this.settings.languages.registeredLanguages            
            .findIndex(language => language.label == label);
    }

    getLanguageIndexByName(name: string):number {        
        return this.settings.languages.registeredLanguages            
            .findIndex(language => language.name == name);        
    }

    getLanguage(index: number):Language {               
        return this.settings.languages.registeredLanguages[index];
    }




    // getWordsOfLanguage(languageLabel: string): Word[] {
    //
    // }
    //
    // private getLanguageIdByLabel(label: string): number {
    //     if
    // }



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
