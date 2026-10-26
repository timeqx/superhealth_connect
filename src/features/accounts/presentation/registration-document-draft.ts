const databaseName = "superhealth-registration";
const storeName = "qc-id-drafts";

type Draft = { id: string; file: File; createdAt: number };
const draftLifetimeMs = 24 * 60 * 60 * 1000;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName))
        request.result.createObjectStore(storeName, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("QC_ID_DRAFT_STORAGE_FAILED"));
  });
}

export async function saveRegistrationDocument(file: File): Promise<string> {
  const id = crypto.randomUUID();
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put({ id, file, createdAt: Date.now() } satisfies Draft);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("QC_ID_DRAFT_STORAGE_FAILED"));
      transaction.onabort = () => reject(transaction.error ?? new Error("QC_ID_DRAFT_STORAGE_FAILED"));
    });
    return id;
  } finally {
    database.close();
  }
}

export async function readRegistrationDocument(id: string): Promise<File | null> {
  const database = await openDatabase();
  let expired = false;
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(storeName, "readonly").objectStore(storeName).get(id);
      request.onsuccess = () => {
        const draft = request.result as Draft | undefined;
        expired = Boolean(draft && Date.now() - draft.createdAt > draftLifetimeMs);
        resolve(!expired && draft?.file instanceof File ? draft.file : null);
      };
      request.onerror = () => reject(request.error ?? new Error("QC_ID_DRAFT_READ_FAILED"));
    });
  } finally {
    database.close();
    if (expired) await deleteRegistrationDocument(id);
  }
}

export async function deleteRegistrationDocument(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("QC_ID_DRAFT_DELETE_FAILED"));
      transaction.onabort = () => reject(transaction.error ?? new Error("QC_ID_DRAFT_DELETE_FAILED"));
    });
  } finally {
    database.close();
  }
}
