import { NgModule }      from '@angular/core';
// import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { HttpModule }    from '@angular/http'
// import { FormsModule }   from '@angular/forms';

import { AppComponent }  from './app.component';

import { TestingComponent } from './testing.component';
import { DatabaseComponent } from './database.component';
import { SettingsComponent } from './settings.component';

const appRoutes: Routes = [
  {
      path: 'testing',
      component: TestingComponent
  },
  {
      path: 'database',
      component: DatabaseComponent
  },
  {
    path: 'settings',
    component: SettingsComponent
    // data: { title: 'Heroes List' }
  },
  {
    path: '',
    redirectTo: '/testing',
    pathMatch: 'full'
  }
  // { path: '**', component: PageNotFoundComponent }
];

@NgModule({
    imports: [
        RouterModule.forRoot(appRoutes, { useHash: true }),
        BrowserModule,
        HttpModule
    ],
    declarations: [ AppComponent, TestingComponent, DatabaseComponent, SettingsComponent ],
    bootstrap:    [ AppComponent ]
    // providers: [ {provide: LocationStrategy, useClass: HashLocationStrategy} ]
})
export class AppModule { }
