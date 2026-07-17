import { convertToParamMap, ParamMap, Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

export function createActivatedRouteMock(params: Params = {}, queryParams: Params = {}) {
  const paramMap$ = new BehaviorSubject<ParamMap>(convertToParamMap(params));
  const queryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap(queryParams));

  return {
    snapshot: {
      params,
      queryParams,
      paramMap: convertToParamMap(params),
      queryParamMap: convertToParamMap(queryParams),
    },
    params: new BehaviorSubject(params).asObservable(),
    queryParams: new BehaviorSubject(queryParams).asObservable(),
    paramMap: paramMap$.asObservable(),
    queryParamMap: queryParamMap$.asObservable(),
    setParamMap: (nextParams: Params) => paramMap$.next(convertToParamMap(nextParams)),
    setQueryParamMap: (nextQueryParams: Params) =>
      queryParamMap$.next(convertToParamMap(nextQueryParams)),
  };
}

export function createRouterMock() {
  return {
    url: '/',
    navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    navigateByUrl: jasmine.createSpy('navigateByUrl').and.resolveTo(true),
    createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((commands: unknown[]) => ({
      commands,
      toString: () => commands.join('/'),
    })),
    parseUrl: jasmine.createSpy('parseUrl').and.callFake((url: string) => ({
      url,
      toString: () => url,
    })),
  };
}
