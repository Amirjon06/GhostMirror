from dataclasses import replace

from app.api.monitor import get_monitor_manager
from app.main import app
from app.services.monitor import (
    MonitorAlreadyRunning,
    MonitorConfigurationError,
    MonitorStatusSnapshot,
    MonitorWorkerSnapshot,
)


class FakeMonitorManager:
    def __init__(self) -> None:
        self.clipboard = MonitorWorkerSnapshot(name="clipboard")
        self.filesystem = MonitorWorkerSnapshot(name="filesystem")
        self.fail_with: Exception | None = None

    def status(self) -> MonitorStatusSnapshot:
        return MonitorStatusSnapshot(clipboard=self.clipboard, filesystem=self.filesystem)

    def start_clipboard(self, interval_seconds: float = 1.0) -> MonitorStatusSnapshot:
        if self.fail_with is not None:
            raise self.fail_with

        self.clipboard = replace(
            self.clipboard,
            running=True,
            interval_seconds=interval_seconds,
            stopped_at=None,
        )
        return self.status()

    def stop_clipboard(self) -> MonitorStatusSnapshot:
        self.clipboard = replace(self.clipboard, running=False)
        return self.status()

    def start_filesystem(
        self,
        path: str,
        interval_seconds: float = 5.0,
        include_hidden: bool = False,
    ) -> MonitorStatusSnapshot:
        if self.fail_with is not None:
            raise self.fail_with

        self.filesystem = replace(
            self.filesystem,
            running=True,
            interval_seconds=interval_seconds,
            watch_path=path,
            include_hidden=include_hidden,
            stopped_at=None,
        )
        return self.status()

    def stop_filesystem(self) -> MonitorStatusSnapshot:
        self.filesystem = replace(self.filesystem, running=False)
        return self.status()


def override_monitor_manager(fake: FakeMonitorManager) -> None:
    app.dependency_overrides[get_monitor_manager] = lambda: fake


def test_get_monitor_status(client):
    fake = FakeMonitorManager()
    override_monitor_manager(fake)

    response = client.get("/monitors/status")

    assert response.status_code == 200
    assert response.json()["clipboard"]["running"] is False
    assert response.json()["filesystem"]["running"] is False


def test_start_and_stop_clipboard_monitor(client):
    fake = FakeMonitorManager()
    override_monitor_manager(fake)

    start_response = client.post("/monitors/clipboard/start", json={"interval_seconds": 2})

    assert start_response.status_code == 200
    assert start_response.json()["clipboard"] == {
        "name": "clipboard",
        "running": True,
        "interval_seconds": 2.0,
        "watch_path": None,
        "include_hidden": False,
        "events_created": 0,
        "last_event_id": None,
        "last_checked_at": None,
        "last_error": None,
        "started_at": None,
        "stopped_at": None,
    }

    stop_response = client.post("/monitors/clipboard/stop")

    assert stop_response.status_code == 200
    assert stop_response.json()["clipboard"]["running"] is False


def test_start_and_stop_filesystem_monitor(client):
    fake = FakeMonitorManager()
    override_monitor_manager(fake)

    start_response = client.post(
        "/monitors/filesystem/start",
        json={
            "path": "/workspace/project",
            "interval_seconds": 10,
            "include_hidden": True,
        },
    )

    assert start_response.status_code == 200
    filesystem = start_response.json()["filesystem"]
    assert filesystem["running"] is True
    assert filesystem["watch_path"] == "/workspace/project"
    assert filesystem["interval_seconds"] == 10.0
    assert filesystem["include_hidden"] is True

    stop_response = client.post("/monitors/filesystem/stop")

    assert stop_response.status_code == 200
    assert stop_response.json()["filesystem"]["running"] is False


def test_start_monitor_returns_conflict_when_worker_is_running(client):
    fake = FakeMonitorManager()
    fake.fail_with = MonitorAlreadyRunning("Clipboard monitor is already running.")
    override_monitor_manager(fake)

    response = client.post("/monitors/clipboard/start", json={"interval_seconds": 1})

    assert response.status_code == 409
    assert response.json()["detail"] == "Clipboard monitor is already running."


def test_start_monitor_returns_bad_request_for_invalid_configuration(client):
    fake = FakeMonitorManager()
    fake.fail_with = MonitorConfigurationError("Directory does not exist: /missing")
    override_monitor_manager(fake)

    response = client.post(
        "/monitors/filesystem/start",
        json={"path": "/missing", "interval_seconds": 5},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Directory does not exist: /missing"


def test_monitor_start_validates_interval(client):
    fake = FakeMonitorManager()
    override_monitor_manager(fake)

    response = client.post("/monitors/clipboard/start", json={"interval_seconds": 0})

    assert response.status_code == 422
