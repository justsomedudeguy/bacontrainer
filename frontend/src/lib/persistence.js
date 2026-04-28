const STORAGE_KEY = 'legalsim.local.settings.v2';

const EMPTY_STATE = {
  activeWorkspace: 'simulator',
  selectedScenarioId: '',
  selectedProviderId: '',
  providerConfigs: {},
  providerModels: {},
  inventedScenarios: [],
  courtlistenerConfig: {
    apiToken: ''
  }
};

function isBrowser() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function loadPersistentState() {
  if (!isBrowser()) {
    return EMPTY_STATE;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return EMPTY_STATE;
    }

    const parsedValue = JSON.parse(rawValue);

    return {
      ...EMPTY_STATE,
      ...(parsedValue && typeof parsedValue === 'object' ? parsedValue : {})
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function savePersistentState(state) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...EMPTY_STATE,
      ...(state && typeof state === 'object' ? state : {})
    })
  );
}
