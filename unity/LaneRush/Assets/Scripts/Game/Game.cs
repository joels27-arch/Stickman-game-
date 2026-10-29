// The game: menu → endless run → game over, the camera (all four lanes always in view), the
// controls (swipes on a phone, arrows/WASD + space + E on a keyboard) and the HUD.
// Step 1 of the Unity port: the Endless Run with the web game's courses, maps and runners.
using UnityEngine;

namespace LaneRush
{
    public sealed class Game : MonoBehaviour
    {
        enum Mode { Menu, Run, Over }

        Mode mode = Mode.Menu;
        Camera cam;
        World world;
        CourseView view;
        Runner runner;
        RunnerModel model;
        Sfx sfx;
        int mapIndex, runnerIndex;
        string toast = "";
        float toastT;
        Vector3 camPos;
        Vector2? swipeFrom;
        bool swiped;
        GUIStyle big, mid, small, button, chip, chipOn;

        int Best { get => PlayerPrefs.GetInt("lr:best", 0); set => PlayerPrefs.SetInt("lr:best", value); }
        int Bank { get => PlayerPrefs.GetInt("lr:coins", 0); set => PlayerPrefs.SetInt("lr:coins", value); }

        void Awake()
        {
            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 0;
            mapIndex = Mathf.Clamp(PlayerPrefs.GetInt("lr:map", 0), 0, MapTheme.All.Length - 1);
            runnerIndex = Mathf.Clamp(PlayerPrefs.GetInt("lr:char", 0), 0, RunnerModel.Names.Length - 1);

            cam = Camera.main;
            if (cam == null) cam = new GameObject("Main Camera") { tag = "MainCamera" }.AddComponent<Camera>();
            cam.nearClipPlane = 0.1f;
            foreach (var l in FindObjectsOfType<Light>()) if (l.type == LightType.Directional) l.gameObject.SetActive(false); // ours is per map

            world = new GameObject("World").AddComponent<World>();
            view = new GameObject("Course view").AddComponent<CourseView>();
            runner = new GameObject("Runner").AddComponent<Runner>();
            model = new GameObject("Model").AddComponent<RunnerModel>();
            model.transform.SetParent(runner.transform, false);
            sfx = gameObject.AddComponent<Sfx>();
            runner.Toast += (t) => { toast = t; toastT = 1.6f; };
            runner.Sfx += (s) => sfx.Play(s);
            Prepare();
        }

        /// <summary>Build the map and a fresh course; the runner stands at the start.</summary>
        void Prepare()
        {
            var theme = MapTheme.All[mapIndex];
            world.Build(theme, cam);
            uint seed = (uint)Random.Range(1, int.MaxValue);
            view.Build(CourseBuilder.Build(seed, Rules.SurvivalLen), theme, seed);
            model.Setup(runnerIndex);
            runner.Begin(view, model);
            runner.transform.position = new Vector3(World.LaneX(1), 0, 0);
            camPos = new Vector3(0, 3.1f, -5.6f);
            view.Tick(0, 0);
            world.Follow(0);
        }

        void StartRun()
        {
            PlayerPrefs.SetInt("lr:map", mapIndex);
            PlayerPrefs.SetInt("lr:char", runnerIndex);
            Prepare();
            mode = Mode.Run;
            model.Play("run");
            sfx.Play("go");
        }

        void Update()
        {
            float dt = Mathf.Min(Time.deltaTime, 0.05f);
            if (mode == Mode.Run)
            {
                ReadInput();
                runner.Tick(dt);
                view.Tick(runner.D, runner.RunTime);
                world.Follow((float)runner.D);
                if (runner.Out)
                {
                    mode = Mode.Over;
                    int dist = (int)runner.D;
                    if (dist > Best) Best = dist;
                    Bank = Bank + runner.Coins;
                    PlayerPrefs.Save();
                    sfx.Play("over");
                }
            }
            else model.Tick(dt, false);
            toastT -= dt;
            Follow(dt);
        }

        // ── camera: behind and above, all four lanes always on screen ──
        void Follow(float dt)
        {
            bool portrait = cam.aspect < 0.8f;
            float back = portrait ? 5.6f : 4.7f, up = portrait ? 3.1f : 2.65f;
            float tx = World.LaneX(runner.X) * (portrait ? 0.3f : 0.75f);
            float d = (float)runner.D, y = runner.Y;
            var goal = new Vector3(tx, up + y * 0.75f, d - back);
            camPos = Vector3.Lerp(camPos, goal, Mathf.Min(1, dt * 6));
            if (mode == Mode.Menu) camPos = new Vector3(Mathf.Sin(Time.time * 0.3f) * 1.5f, 2.2f, d + 4.5f); // look at your runner from the front
            cam.transform.position = camPos;
            if (mode == Mode.Menu) cam.transform.LookAt(new Vector3(World.LaneX(1), 1f, d));
            else cam.transform.LookAt(new Vector3(tx * 0.8f, 1.15f + y * 0.6f, d + 10));
            float halfW = World.LaneW * 1.5f + 0.9f + Mathf.Abs(tx);
            float need = 2 * Mathf.Atan(halfW / (back + 5) / cam.aspect) * Mathf.Rad2Deg;
            float fov = runner.Active == Power.Rocket ? 80 : runner.BoostT > 0 ? 70 : 62 + Mathf.Clamp((runner.Speed - 12) * 0.45f, 0, 5);
            fov = Mathf.Min(100, Mathf.Max(fov, need));
            cam.fieldOfView = Mathf.Lerp(cam.fieldOfView, fov, Mathf.Min(1, dt * 5));
        }

        // ── controls ──
        void ReadInput()
        {
            if (Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A)) runner.Move(-1);
            if (Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D)) runner.Move(1);
            if (Input.GetKeyDown(KeyCode.UpArrow) || Input.GetKeyDown(KeyCode.W) || Input.GetKeyDown(KeyCode.Space)) runner.Jump();
            if (Input.GetKeyDown(KeyCode.DownArrow) || Input.GetKeyDown(KeyCode.S)) runner.Slide();
            if (Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.Return)) runner.UseItem();

            // swipes (touch, or a mouse drag in the editor): one move per swipe
            bool down = Input.touchCount > 0 ? Input.GetTouch(0).phase == TouchPhase.Began : Input.GetMouseButtonDown(0);
            bool held = Input.touchCount > 0 || Input.GetMouseButton(0);
            Vector2 pos = Input.touchCount > 0 ? Input.GetTouch(0).position : (Vector2)Input.mousePosition;
            if (down && !OverItemButton(pos)) { swipeFrom = pos; swiped = false; }
            if (!held) swipeFrom = null;
            if (swipeFrom.HasValue && !swiped)
            {
                var delta = pos - swipeFrom.Value;
                float min = Screen.dpi > 0 ? Screen.dpi * 0.18f : 40f;
                if (delta.magnitude > min)
                {
                    swiped = true;
                    if (Mathf.Abs(delta.x) > Mathf.Abs(delta.y)) runner.Move(delta.x > 0 ? 1 : -1);
                    else if (delta.y > 0) runner.Jump();
                    else runner.Slide();
                }
            }
        }

        Rect ItemRect => new Rect(Screen.width - S(120), Screen.height - S(130), S(100), S(100));
        bool OverItemButton(Vector2 screenPos) => ItemRect.Contains(new Vector2(screenPos.x, Screen.height - screenPos.y));

        // ── HUD and menus (IMGUI for now: a proper UI comes in a later step) ──
        float S(float px) => px * Mathf.Max(1f, Mathf.Min(Screen.width, Screen.height) / 420f);

        void Styles()
        {
            if (big != null) return;
            big = new GUIStyle(GUI.skin.label) { fontStyle = FontStyle.BoldAndItalic, alignment = TextAnchor.MiddleCenter, normal = { textColor = Color.white } };
            mid = new GUIStyle(big) { fontStyle = FontStyle.Bold };
            small = new GUIStyle(mid) { fontStyle = FontStyle.Normal };
            button = new GUIStyle(GUI.skin.button) { fontStyle = FontStyle.BoldAndItalic };
            chip = new GUIStyle(GUI.skin.button);
            chipOn = new GUIStyle(GUI.skin.button) { normal = { textColor = new Color(0.7f, 1f, 0.2f) }, fontStyle = FontStyle.Bold };
        }

        void Label(Rect r, string text, GUIStyle st, float size, Color? col = null)
        {
            st.fontSize = Mathf.RoundToInt(S(size));
            var keep = st.normal.textColor;
            var shadow = new Rect(r.x + S(2), r.y + S(2), r.width, r.height);
            st.normal.textColor = new Color(0, 0, 0, 0.55f);
            GUI.Label(shadow, text, st);
            st.normal.textColor = col ?? keep;
            GUI.Label(r, text, st);
            st.normal.textColor = keep;
        }

        void OnGUI()
        {
            Styles();
            float w = Screen.width, h = Screen.height;
            var lime = new Color(0.71f, 0.97f, 0.16f);
            if (mode == Mode.Menu)
            {
                Label(new Rect(0, S(40), w, S(60)), "4 FRIENDS", big, 44, lime);
                Label(new Rect(0, S(92), w, S(30)), "Lane Rush · Endless Run", mid, 18);
                Label(new Rect(0, S(122), w, S(26)), $"Best {Best:N0} m  ·  {Bank:N0} coins", small, 14);
                // map and runner pickers
                Label(new Rect(0, h - S(330), w, S(26)), "MAP", mid, 15);
                Picker(new Rect(S(12), h - S(302), w - S(24), S(44)), MapTheme.All.Length, mapIndex, i => MapTheme.All[i].Label, i => { mapIndex = i; Prepare(); });
                Label(new Rect(0, h - S(250), w, S(26)), "RUNNER", mid, 15);
                Picker(new Rect(S(12), h - S(222), w - S(24), S(44)), RunnerModel.Names.Length, runnerIndex, i => RunnerModel.Names[i], i => { runnerIndex = i; model.Setup(i); });
                button.fontSize = Mathf.RoundToInt(S(26));
                if (GUI.Button(new Rect(w / 2 - S(150), h - S(160), S(300), S(70)), "RUN!", button)) StartRun();
                Label(new Rect(0, h - S(80), w, S(40)), "Swipe ← → to change lanes · ↑ jump · ↓ slide\nKeyboard: arrows / WASD, Space, E = item", small, 12);
                return;
            }

            // in the run
            Label(new Rect(S(14), S(16), S(200), S(34)), $"{(int)runner.D:N0} m", mid, 24, lime);
            Label(new Rect(S(14), S(50), S(200), S(26)), $"● {runner.Coins}", mid, 18, new Color(1f, 0.82f, 0.2f));
            string hearts = new string('♥', Mathf.Max(0, runner.Lives));
            Label(new Rect(w - S(214), S(16), S(200), S(34)), hearts, mid, 26, new Color(1f, 0.3f, 0.4f));
            if (toastT > 0) Label(new Rect(0, h * 0.28f, w, S(50)), toast, big, 28);

            // the item slot: tap to use
            var ir = ItemRect;
            string item = runner.Active != Power.None ? (runner.Active == Power.Shield ? "SHIELD\n" : "ROCKET\n") + Mathf.CeilToInt(runner.PowerT) + "s"
                : runner.Held == Power.Shield ? "SHIELD\n(tap)" : runner.Held == Power.Rocket ? "ROCKET\n(tap)" : "-";
            button.fontSize = Mathf.RoundToInt(S(15));
            if (GUI.Button(ir, item, button) && mode == Mode.Run) runner.UseItem();

            if (mode == Mode.Over)
            {
                GUI.color = new Color(0, 0, 0, 0.55f);
                GUI.DrawTexture(new Rect(0, 0, w, h), Texture2D.whiteTexture);
                GUI.color = Color.white;
                Label(new Rect(0, h * 0.22f, w, S(60)), "RUN OVER", big, 40, lime);
                Label(new Rect(0, h * 0.22f + S(64), w, S(40)), $"{(int)runner.D:N0} m  ·  {runner.Coins} coins", mid, 22);
                Label(new Rect(0, h * 0.22f + S(100), w, S(30)), (int)runner.D >= Best ? "NEW BEST!" : $"Best {Best:N0} m", small, 16, (int)runner.D >= Best ? lime : (Color?)null);
                button.fontSize = Mathf.RoundToInt(S(24));
                if (GUI.Button(new Rect(w / 2 - S(150), h * 0.55f, S(300), S(64)), "RUN AGAIN", button)) StartRun();
                if (GUI.Button(new Rect(w / 2 - S(150), h * 0.55f + S(76), S(300), S(50)), "MENU", button)) { mode = Mode.Menu; Prepare(); }
            }
        }

        /// <summary>A row of chips with ‹ › arrows: one choice out of many.</summary>
        void Picker(Rect r, int count, int sel, System.Func<int, string> label, System.Action<int> pick)
        {
            chip.fontSize = chipOn.fontSize = Mathf.RoundToInt(S(15));
            float aw = S(44);
            if (GUI.Button(new Rect(r.x, r.y, aw, r.height), "‹", chip)) pick((sel - 1 + count) % count);
            if (GUI.Button(new Rect(r.xMax - aw, r.y, aw, r.height), "›", chip)) pick((sel + 1) % count);
            GUI.Label(new Rect(r.x + aw, r.y, r.width - 2 * aw, r.height), label(sel), chipOn);
        }
    }
}
