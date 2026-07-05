from src.ingestion import supabase_store


def test_is_reachable_false_when_unconfigured(monkeypatch):
    supabase_store._client.cache_clear()
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_KEY", raising=False)
    monkeypatch.setattr(supabase_store, "SUPABASE_URL", None)
    monkeypatch.setattr(supabase_store, "SUPABASE_KEY", None)
    assert supabase_store.is_reachable() is False


def test_is_reachable_true_when_query_succeeds(monkeypatch):
    supabase_store._client.cache_clear()

    class FakeQuery:
        def select(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            return None

    class FakeClient:
        def table(self, name):
            return FakeQuery()

    monkeypatch.setattr(supabase_store, "_client", lambda: FakeClient())
    assert supabase_store.is_reachable() is True


def test_is_reachable_false_when_query_raises(monkeypatch):
    supabase_store._client.cache_clear()

    class FakeQuery:
        def select(self, *_a, **_k):
            return self

        def limit(self, *_a, **_k):
            return self

        def execute(self):
            raise RuntimeError("unreachable")

    class FakeClient:
        def table(self, name):
            return FakeQuery()

    monkeypatch.setattr(supabase_store, "_client", lambda: FakeClient())
    assert supabase_store.is_reachable() is False
