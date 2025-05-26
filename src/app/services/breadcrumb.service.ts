import { Injectable } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
private readonly _breadcrumbs$ = new BehaviorSubject<any[]>([]); // Initialize with empty array
readonly breadcrumbs$ = this._breadcrumbs$.asObservable();

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const breadcrumbs = this.createBreadcrumbs(this.activatedRoute.root);
        this._breadcrumbs$.next(breadcrumbs);
      });
  }

  private createBreadcrumbs(route: ActivatedRoute, url: string = '', breadcrumbs: any[] = []): any[] {
    const children: ActivatedRoute[] = route.children;

    if (children.length === 0) {
      return breadcrumbs;
    }

    for (const child of children) {
      const routeURL: string = child.snapshot.url.map(segment => segment.path).join('/');
      if (routeURL !== '') {
        url += `/${routeURL}`;
      }

      const breadcrumbData = child.snapshot.data['breadcrumb'];
      if (breadcrumbData) {
        if (Array.isArray(breadcrumbData)) {
          // Handle array of breadcrumbs
          breadcrumbData.forEach(item => {
            breadcrumbs.push({
              label: item.label,
              url: item.url
            });
          });
        } else {
          // Handle single breadcrumb (backward compatibility)
          breadcrumbs.push({
            label: breadcrumbData,
            url: url
          });
        }
      }

      return this.createBreadcrumbs(child, url, breadcrumbs);
    }

    return breadcrumbs;
  }
}
