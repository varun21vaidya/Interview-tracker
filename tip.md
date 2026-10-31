**2. Workflow & Architecture Strategies**

**The "Split Identity" Framework**

- **Thread A (The Architect):** Run a dedicated chat session exclusively to discuss high-level architecture, state management (e.g., Zustand, Redux), and database/API schemas. Update this thread when your master plan changes.
- **Thread B (The Builder):** Copy the blueprints generated in Thread A into a fresh, separate chat to write the actual code. This keeps the builder thread lightweight and focused.

**Aggressive Chat Pruning**

- **Commit and Clear:** Once a feature or screen is completed, successfully tested, and committed to Git, **delete or abandon the chat thread**.
- **Fresh Starts:** Start a brand-new chat for the next feature. Claude performs significantly faster and makes fewer logic loops in short, hyper-focused threads.

---

**3. Context & Token Reduction Hacks**

**Unified Diff Code Generation**

- Stop **Claude** from rewriting entire 300-line files to change minor UI elements.
- **The Rule:** Force Claude to output only the specific lines that change using a diff format. You can use standard markdown structures to separate your code:
    
    **xml**
    
    ```
    <instruction>Add an onPress handler to the primary button</instruction>
    <current_code>
    [Paste only the target component, not the whole file]
    </current_code>
    ```
    
    Use code with caution.
    

**Structural Pruning**

- **Strip Boilerplate:** Before pasting code into the chat window, manually delete all `console.log` statements, legacy comments, and redundant styling objects.
- **Signatures Over Bodies:** If Claude needs to understand your helper utilities or navigation layout, do not paste the entire file. Paste only the type definitions and function signatures (e.g., export statements, parameters, and return types).

**Protect Prompt Caching**

- **Keep the Base Static:** Keep your base configuration or master plan identical at the absolute beginning of your threads. Claude automatically caches these static initial blocks to drastically reduce processing time.
- **Do Not Edit Early Prompts:** Modifying an older message midway through a long conversation completely invalidates the cache, forcing the model to reprocess the entire history from scratch.

---

**4. Expo & React Native Implementation Rules**

**Component-Driven Isolation**

- Keep your Expo project modular. Break down large screens into small, atomic components (e.g., `CustomButton.tsx`, `Header.tsx`).
- When debugging an issue, you only have to feed Claude a 30-line atomic component file rather than a massive 500-line layout wrapper.

**Configuration Snippets**

- Never paste your complete `app.json` or `package.json` files.
- If you are troubleshooting an Expo plugin, native credential configuration, or dependency conflict, paste only the specific nested object array (like `expo.plugins` or `dependencies`) that is triggering the error.

**Automated Error Feedback**

- Do not spend tokens trying to explain a crash in your own words.
- Copy the raw, unedited stack trace directly out of your **Metro Bundler terminal** or the **Hermes red screen simulator**. Drop it straight into Claude wrapped in `<error>` tags. The model is highly optimized to pinpoint line failures instantly when given raw compiler text.