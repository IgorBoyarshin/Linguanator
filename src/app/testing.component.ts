import { Component, OnInit } from '@angular/core';
import { DatabaseService } from './database.service';

@Component({
    selector: 'testing',
    templateUrl: './testing.component.html'
})
export class TestingComponent implements OnInit {
    constructor(private databaseService : DatabaseService) {}

    ngOnInit(): void {
        this.databaseService.init()
            .then(() => this.onDatabaseLoad());
    }

    private onDatabaseLoad(): void {

    }
}
