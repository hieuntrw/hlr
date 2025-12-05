declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// supabase/functions may use Fetch API and other globals; declare minimal types
declare function fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
