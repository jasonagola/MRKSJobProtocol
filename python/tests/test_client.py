from mrks_job_protocol.client import JobProtocolClient


def test_events_url_encodes_cursor() -> None:
    client = JobProtocolClient("https://example.test/")
    assert client.events_url("abc", after="cursor") == "https://example.test/v1/jobs/abc/events?after=cursor"
