#[macro_use]
extern crate objc;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg(target_os = "macos")]
unsafe fn setup_pressure_monitor(app_handle: tauri::AppHandle) {
    use tauri::Emitter;

    let mask = 0x400000000u64; // NSEventMaskPressure (1ULL << 34)

    // Create the global monitor block (runs in background)
    let global_app_handle = app_handle.clone();
    let global_block = block::ConcreteBlock::new(move |event: *mut objc::runtime::Object| {
        let pressure: f32 = unsafe { objc::msg_send![event, pressure] };
        let _ = global_app_handle.emit("pressure-changed", pressure);
    });
    let global_block = global_block.copy();

    // Create the local monitor block (runs when window is active)
    let local_app_handle = app_handle.clone();
    let local_block = block::ConcreteBlock::new(move |event: *mut objc::runtime::Object| -> *mut objc::runtime::Object {
        let pressure: f32 = unsafe { objc::msg_send![event, pressure] };
        let _ = local_app_handle.emit("pressure-changed", pressure);
        event
    });
    let local_block = local_block.copy();

    let ns_event = objc::class!(NSEvent);

    let _: *mut objc::runtime::Object = unsafe {
        objc::msg_send![
            ns_event,
            addGlobalMonitorForEventsMatchingMask: mask
            handler: &*global_block
        ]
    };

    let _: *mut objc::runtime::Object = unsafe {
        objc::msg_send![
            ns_event,
            addLocalMonitorForEventsMatchingMask: mask
            handler: &*local_block
        ]
    };

    // Leak the copied heap blocks so AppKit can safely execute them
    // for the lifetime of the application without crashes.
    std::mem::forget(global_block);
    std::mem::forget(local_block);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            unsafe {
                setup_pressure_monitor(app.handle().clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
