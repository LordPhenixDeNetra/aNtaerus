import json
import datetime


def main(args: dict) -> dict:
    return {
        "ok": True,
        "echo": args,
        "now": datetime.datetime.utcnow().isoformat() + "Z",
    }


if __name__ == "__main__":
    import sys

    payload = {}
    if len(sys.argv) > 1:
        payload = json.loads(sys.argv[1])
    print(json.dumps(main(payload)))
