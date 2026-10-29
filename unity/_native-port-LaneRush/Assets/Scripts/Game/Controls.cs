// Keyboard, mouse and touch, read through Unity's new Input System when the project uses it
// (the default in Unity 6), or the old Input Manager otherwise. The game only asks:
// "was this key pressed this frame?", "where is the finger / mouse?", "is it down?".
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace LaneRush
{
    public enum GameKey { Left, Right, Jump, Slide, Item }

    public static class Controls
    {
        public static bool Pressed(GameKey k)
        {
#if ENABLE_INPUT_SYSTEM
            var kb = Keyboard.current;
            if (kb == null) return false;
            switch (k)
            {
                case GameKey.Left: return kb.leftArrowKey.wasPressedThisFrame || kb.aKey.wasPressedThisFrame;
                case GameKey.Right: return kb.rightArrowKey.wasPressedThisFrame || kb.dKey.wasPressedThisFrame;
                case GameKey.Jump: return kb.upArrowKey.wasPressedThisFrame || kb.wKey.wasPressedThisFrame || kb.spaceKey.wasPressedThisFrame;
                case GameKey.Slide: return kb.downArrowKey.wasPressedThisFrame || kb.sKey.wasPressedThisFrame;
                default: return kb.eKey.wasPressedThisFrame || kb.enterKey.wasPressedThisFrame;
            }
#else
            switch (k)
            {
                case GameKey.Left: return Input.GetKeyDown(KeyCode.LeftArrow) || Input.GetKeyDown(KeyCode.A);
                case GameKey.Right: return Input.GetKeyDown(KeyCode.RightArrow) || Input.GetKeyDown(KeyCode.D);
                case GameKey.Jump: return Input.GetKeyDown(KeyCode.UpArrow) || Input.GetKeyDown(KeyCode.W) || Input.GetKeyDown(KeyCode.Space);
                case GameKey.Slide: return Input.GetKeyDown(KeyCode.DownArrow) || Input.GetKeyDown(KeyCode.S);
                default: return Input.GetKeyDown(KeyCode.E) || Input.GetKeyDown(KeyCode.Return);
            }
#endif
        }

        /// <summary>The pointer (first finger, or the mouse): went down this frame, is held, where it is (screen pixels, y up).</summary>
        public static void Pointer(out bool down, out bool held, out Vector2 pos)
        {
#if ENABLE_INPUT_SYSTEM
            var ts = Touchscreen.current;
            if (ts != null && (ts.primaryTouch.press.isPressed || ts.primaryTouch.press.wasReleasedThisFrame))
            {
                down = ts.primaryTouch.press.wasPressedThisFrame;
                held = ts.primaryTouch.press.isPressed;
                pos = ts.primaryTouch.position.ReadValue();
                return;
            }
            var m = Mouse.current;
            down = m != null && m.leftButton.wasPressedThisFrame;
            held = m != null && m.leftButton.isPressed;
            pos = m != null ? m.position.ReadValue() : Vector2.zero;
#else
            if (Input.touchCount > 0)
            {
                var t = Input.GetTouch(0);
                down = t.phase == TouchPhase.Began;
                held = true;
                pos = t.position;
                return;
            }
            down = Input.GetMouseButtonDown(0);
            held = Input.GetMouseButton(0);
            pos = Input.mousePosition;
#endif
        }
    }
}
