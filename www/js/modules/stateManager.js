// www/js/modules/stateManager.js -> Bu kodu eskisiyle değiştirin

export class StateManager {
    constructor() {
        this.subscribers = new Set();
        this.middleware = [this.loggerMiddleware];
        // --- YENİ ---: Uygulama başladığında sessionStorage'dan state'i yükle
        this.state = this.loadState() || this.getInitialState();
    }

    getInitialState() {
        // Orijinal başlangıç durumu
        return {
            user: null,
            problem: { solution: null, source: null },
            ui: { 
                view: 'setup', 
                isLoading: false, 
                error: null, 
                inputMode: 'photo', 
                handwritingInputType: 'keyboard',
                interactiveStep: 0 
            },
        };
    }

    // --- YENİ ---: sessionStorage'dan state yükleme fonksiyonu
    loadState() {
        try {
            const serializedState = sessionStorage.getItem('appState');
            if (serializedState === null) {
                return undefined;
            }
            return JSON.parse(serializedState);
        } catch (err) {
            console.error("State yüklenemedi:", err);
            return undefined;
        }
    }

    // --- YENİ ---: sessionStorage'a state kaydetme fonksiyonu
    saveState(state) {
        try {
            const serializedState = JSON.stringify(state);
            sessionStorage.setItem('appState', serializedState);
        } catch (err) {
            console.error("State kaydedilemedi:", err);
        }
    }

    subscribe(callback) {
        this.subscribers.add(callback);
        callback(this.state);
        return () => this.subscribers.delete(callback);
    }

    dispatch(action) {
        const prevState = this.state;
        const newState = this.reducer(prevState, action);

        if (newState === prevState) {
            return;
        }

        this.middleware.forEach(mw => mw(action, prevState, newState));
        this.state = newState;
        
        // --- YENİ ---: Her state değişikliğinden sonra sessionStorage'a kaydet
        this.saveState(newState);

        this.subscribers.forEach(cb => cb(newState));
    }
    
    // reset fonksiyonunu sessionStorage'ı temizleyecek şekilde güncelle
    reset() {
        // Hem state'i sıfırla hem de sessionStorage'daki kaydı sil
        sessionStorage.removeItem('appState');
        this.dispatch({ type: 'RESET' });
    }

    // Geri kalan reducer ve action creator fonksiyonları aynı kalacak...
    // ... (hiçbir değişiklik yapmanıza gerek yok)
    reducer(state, action) {
        const newUser = this.userReducer(state.user, action);
        const newProblem = this.problemReducer(state.problem, action);
        const newUi = this.uiReducer(state.ui, action);

        if (state.user === newUser && state.problem === newProblem && state.ui === newUi) {
            return state;
        }
        return { user: newUser, problem: newProblem, ui: newUi };
    }

    userReducer(state, action) {
        switch (action.type) {
            case 'SET_USER': return action.payload;
            case 'RESET': return state;
            default: return state;
        }
    }

    problemReducer(state, action) {
        switch (action.type) {
            case 'SET_SOLUTION': return { ...state, solution: action.payload };
            case 'SET_PROBLEM_SOURCE': return { ...state, source: action.payload };
            case 'RESET': return { solution: null, source: null };
            default: return state;
        }
    }

    uiReducer(state, action) {
        switch (action.type) {
            case 'SET_VIEW':
                return state.view === action.payload ? state : { ...state, view: action.payload };
            case 'SET_INPUT_MODE':
                return state.inputMode === action.payload ? state : { ...state, inputMode: action.payload };
            case 'SET_HANDWRITING_INPUT_TYPE':
                return state.handwritingInputType === action.payload ? state : { ...state, handwritingInputType: action.payload };
            case 'SET_LOADING':
                if (state.isLoading === action.payload.status && state.loadingMessage === action.payload.message) return state;
                return { ...state, isLoading: action.payload.status, loadingMessage: action.payload.message || '' };
            case 'SET_ERROR':
                return { ...state, isLoading: false, error: action.payload };
            case 'CLEAR_ERROR':
                return state.error === null ? state : { ...state, error: null };
            case 'NEXT_INTERACTIVE_STEP':
                 return { ...state, interactiveStep: state.interactiveStep + 1 };
            case 'SET_INTERACTIVE_STEP':
                 return { ...state, interactiveStep: action.payload };
            case 'RESET':
                return { 
                    view: 'setup', 
                    isLoading: false, 
                    error: null, 
                    inputMode: 'photo', 
                    handwritingInputType: 'keyboard',
                    interactiveStep: 0 
                };
            default: return state;
        }
    }

    loggerMiddleware(action, prevState, newState) {
        console.group(`%cState Action: %c${action.type}`, 'color: gray;', 'color: blue; font-weight: bold;');
        console.log('%cPayload:', 'color: #9E9E9E;', action.payload);
        console.log('%cPrevious State:', 'color: #FF9800;', prevState);
        console.log('%cNew State:', 'color: #4CAF50;', newState);
        console.groupEnd();
    }
    
    getStateValue(key) {
        return this.state[key];
    }
    
    // Action Creators
    setUser = (user) => this.dispatch({ type: 'SET_USER', payload: user });
    setSolution = (solutionData) => this.dispatch({ type: 'SET_SOLUTION', payload: solutionData });
    setLoading = (status, message = '') => this.dispatch({ type: 'SET_LOADING', payload: { status, message } });
    setError = (errorMessage) => this.dispatch({ type: 'SET_ERROR', payload: errorMessage });
    clearError = () => this.dispatch({ type: 'CLEAR_ERROR' });
    setView = (view) => this.dispatch({ type: 'SET_VIEW', payload: view });
    setInputMode = (mode) => this.dispatch({ type: 'SET_INPUT_MODE', payload: mode });
    setHandwritingInputType = (type) => this.dispatch({ type: 'SET_HANDWRITING_INPUT_TYPE', payload: type });
    setInteractiveStep = (step) => this.dispatch({ type: 'SET_INTERACTIVE_STEP', payload: step });
    nextInteractiveStep = () => this.dispatch({ type: 'NEXT_INTERACTIVE_STEP' });
    setProblemSource = (sourceData) => this.dispatch({ type: 'SET_PROBLEM_SOURCE', payload: sourceData });
}