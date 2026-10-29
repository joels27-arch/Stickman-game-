// 4 Friends in Unity: the app shows the real game (the live web version) full screen, so it is
// exactly the same game, and every update of the web game is in the app the next time it opens.
// Starts itself in any scene (even an empty one). Uses the unity-webview plugin (net.gree).
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using Gree.UnityWebView;

public sealed class WebGame : MonoBehaviour
{
    /// <summary>The game: the same address players use in the browser.</summary>
    const string GameUrl = "https://lane-rush-party.higgsfield.app/";

    WebViewObject web;
    bool failed, opening;
    string why = "";
    GUIStyle title, text, button;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        if (FindFirstObjectByType<WebGame>() == null) new GameObject("4 Friends").AddComponent<WebGame>();
    }

    void Awake()
    {
        DontDestroyOnLoad(gameObject);
        Application.targetFrameRate = 60;
        Screen.sleepTimeout = SleepTimeout.NeverSleep; // no dimming mid-race
        Screen.orientation = ScreenOrientation.Portrait;
        var cam = Camera.main;
        if (cam != null)
        {
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.043f, 0.059f, 0.047f); // the game's loading-screen colour
        }
        StartCoroutine(Open());
    }

    IEnumerator Open()
    {
        if (opening) yield break;
        opening = true;
        failed = false;
        // check the connection first (on Android this is also what gives the app internet access)
        using (var req = UnityWebRequest.Head(GameUrl))
        {
            req.timeout = 12;
            yield return req.SendWebRequest();
            if (req.result != UnityWebRequest.Result.Success)
            {
                Fail("No internet connection");
                opening = false;
                yield break;
            }
        }
        if (web == null)
        {
            web = new GameObject("Game (web view)").AddComponent<WebViewObject>();
            DontDestroyOnLoad(web.gameObject);
            web.Init(
                cb: msg => Debug.Log("4 Friends: " + msg),
                err: e => Fail("Couldn't load the game"),
                httpErr: e => Fail("Couldn't load the game (" + e + ")"),
                ld: url => Debug.Log("4 Friends loaded " + url),
                zoom: false,
                wkAllowsLinkPreview: false,
                wkAllowsBackForwardNavigationGestures: false);
            while (!web.IsInitialized()) yield return null;
        }
        web.SetMargins(0, 0, 0, 0); // full screen: the game handles the notch itself
        web.SetVisibility(true);
        web.LoadURL(GameUrl);
        opening = false;
    }

    void Fail(string message)
    {
        failed = true;
        why = message;
        if (web != null) web.SetVisibility(false);
    }

    // the app comes back from the background: if the game couldn't load, try again
    void OnApplicationFocus(bool focus)
    {
        if (focus && failed) StartCoroutine(Open());
    }

    // only shown while the game isn't on screen: loading, or no connection with a retry button
    void OnGUI()
    {
        if (title == null)
        {
            title = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.BoldAndItalic, normal = { textColor = new Color(0.71f, 0.97f, 0.16f) } };
            text = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, normal = { textColor = Color.white }, wordWrap = true };
            button = new GUIStyle(GUI.skin.button) { fontStyle = FontStyle.Bold };
        }
        float k = Mathf.Max(1f, Mathf.Min(Screen.width, Screen.height) / 400f);
        title.fontSize = Mathf.RoundToInt(40 * k);
        text.fontSize = Mathf.RoundToInt(16 * k);
        button.fontSize = Mathf.RoundToInt(20 * k);
        float w = Screen.width, h = Screen.height;
        GUI.Label(new Rect(0, h * 0.3f, w, 60 * k), "4 FRIENDS", title);
        if (!failed)
        {
            GUI.Label(new Rect(0, h * 0.3f + 70 * k, w, 30 * k), "Loading…", text);
            return;
        }
        GUI.Label(new Rect(20 * k, h * 0.3f + 70 * k, w - 40 * k, 50 * k), why + ". Check your connection and try again.", text);
        if (GUI.Button(new Rect(w / 2 - 110 * k, h * 0.3f + 140 * k, 220 * k, 56 * k), "Try again", button)) StartCoroutine(Open());
    }
}
