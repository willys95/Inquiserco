(function (global) {
    const CONFIG_KEY = "inquiserco_supabase_config";
    const DEFAULTS = {
        url: "https://uxfehqfkcthsmvpegzfn.supabase.co",
        key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4ZmVocWZrY3Roc212cGVnemZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDYzMTksImV4cCI6MjA4MDI4MjMxOX0.jEC9vCZy7_XElSnQWMx2D2C0R_l1JCvwhwvjkDGcrEs",
        table: "inquiserco_respaldo",
        record: "principal",
        enabled: false,
    };

    let cachedClient = null;
    let cachedSignature = "";

    const hasConfig = (config) => Boolean(config?.enabled && config?.url && config?.key);

    function loadConfig() {
        try {
            const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}") || {};
            const normalized = { ...DEFAULTS, ...saved };
            if (typeof saved.enabled !== "boolean") {
                normalized.enabled = Boolean(normalized.url && normalized.key);
            }
            return normalized;
        } catch (error) {
            console.error("No se pudo leer la configuración de Supabase", error);
            return { ...DEFAULTS };
        }
    }

    function saveConfig(config) {
        const normalized = { ...DEFAULTS, ...config };
        if (typeof config?.enabled !== "boolean") {
            normalized.enabled = Boolean(normalized.url && normalized.key);
        }
        localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
        cachedClient = null;
        cachedSignature = "";
        return normalized;
    }

    function ensureClient(config = loadConfig()) {
        if (!global.supabase) {
            throw new Error("La librería de Supabase no está disponible.");
        }
        if (!config.url || !config.key) return null;
        const signature = `${config.url}|${config.key}`;
        if (cachedClient && cachedSignature === signature) return cachedClient;
        cachedClient = global.supabase.createClient(config.url, config.key);
        cachedSignature = signature;
        return cachedClient;
    }

    async function testConnection(config = loadConfig()) {
        const client = ensureClient(config);
        if (!client) throw new Error("Configura la URL y la clave anónima de Supabase.");
        const { error } = await client.from(config.table).select("id").limit(1);
        if (error) throw error;
        return true;
    }

    async function pullSnapshot(config = loadConfig()) {
        const client = ensureClient(config);
        if (!client) throw new Error("Configura la URL y la clave anónima de Supabase.");
        const { data, error } = await client
            .from(config.table)
            .select("id,payload,updated_at")
            .eq("id", config.record)
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    async function pushSnapshot(payload, config = loadConfig()) {
        const client = ensureClient(config);
        if (!client) throw new Error("Configura la URL y la clave anónima de Supabase.");
        const snapshot = {
            id: config.record,
            payload,
            updated_at: new Date().toISOString(),
        };
        const { data, error } = await client.from(config.table).upsert(snapshot).select();
        if (error) throw error;
        return data?.[0] ?? snapshot;
    }

    async function pushIfConfigured(payload, config = loadConfig()) {
        if (!hasConfig(config)) return null;
        try {
            return await pushSnapshot(payload, config);
        } catch (error) {
            console.error("No se pudo sincronizar automáticamente con Supabase", error);
            return null;
        }
    }

    async function pullIfConfigured(config = loadConfig()) {
        if (!hasConfig(config)) return null;
        try {
            return await pullSnapshot(config);
        } catch (error) {
            console.error("No se pudo cargar automáticamente desde Supabase", error);
            return null;
        }
    }

    global.SupaSync = {
        loadConfig,
        saveConfig,
        ensureClient,
        testConnection,
        pullSnapshot,
        pushSnapshot,
        hasConfig,
        pushIfConfigured,
        pullIfConfigured,
        defaults: { ...DEFAULTS },
    };
})(window);
