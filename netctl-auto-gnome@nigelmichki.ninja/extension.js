/*
 * Netctl Menu is a Gnome 3 extension that allows you to  switch between netctl
 * profiles using a menu in the notification area.
 *
 * Copyright (C) 2016 Nigel S. Michki 
 * Previous contributors :
 * - Tjaart van der Walt (original creator)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


//Imports/definitions

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const Shell = imports.gi.Shell;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

//Items of interest


//Names of icons for the activities bar
const NETWORK_CONNECTED = 'network-wireless-signal-excellent-symbolic';
//const NETWORK_CONNECTED = 'network-wireless';
const NETWORK_OFFLINE = 'network-wireless-offline-symbolic';
//const NETWORK_OFFLINE = 'network-offline';

const REFRESH_TIME = 3     //seconds

//The extension core
const NetctlSwitcher = new Lang.Class({
   Name: 'NetctlSwitcher',
   Extends: PanelMenu.Button,

   _init: function(){
      this.parent(0.0, 'NetctlSwitcher');

      this.icon = new St.Icon({icon_name: 'network-wireless-acquiring-symbolic', 
         style_class: 'system-status-icon'});
      let box = new St.BoxLayout({vertical: false, 
         style_class: 'panel-status-menu-box'});
      this.label = new St.Label({text: '', y_expand: true, 
         y_align: Clutter.ActorAlign.CENTER});
      box.add_child(this.icon);
      box.add_child(this.label);
      this.actor.add_actor(box);

      //Initial population of the menu
      this._set_icon();
      this._update_menu();

      //Refresh the menu every REFRESH_TIME seconds
      this._refresh_details();
   },

   _netctlOff: function(){
      this._execute_async("netctl-auto disable-all")
   },

   _netctlOn: function(){
      this._execute_async("netctl-auto enable-all")
   },

   _get_network_profiles: async function() {
      var profileString = await this._execute_async("netctl-auto list");
      var profileArray = profileString.split("\n")

      log(profileString, profileArray)
         return profileArray.splice(0, profileArray.length - 1)
   },

   _get_connected_networks: async function() {
      let networks =  await this._execute_async("netctl-auto list");
      let connected = networks.match(/\*.*/g);

      return connected;
   },

   _switch_to_profile: async function(profileName) {
      const out = await this._execute_async("/usr/bin/netctl-auto switch-to " + profileName);
   },

   _execute_async: async function(command) {
      try {
         let [, argv] = GLib.shell_parse_argv(command);
         let proc = new Gio.Subprocess({
            argv,
            flags: Gio.SubprocessFlags.STDOUT_PIPE
         })

         proc.init(null)

         let stdout = await new Promise((resolve, reject) => {
            proc.communicate_utf8_async(null, null, (proc, res) => {
               try {
                  let [ok, stdout, stderr] = proc.communicate_utf8_finish(res);
                  resolve(stdout);
               } catch (e) {
                  reject(e);
               }
            });
         });

         return stdout;
      }
      catch (e) {
         global.logError(e);
      }
   },

   _update_menu: async function() {
      var profiles = await this._get_network_profiles();

      this.menu.removeAll();

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(_('Profiles')));
      for(let i = 0; i < profiles.length; i++){
         this._add_profile_menu_item(profiles[i]);
      }

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(_('Options')));
      this.netctlOffMenuItem = new PopupMenu.PopupMenuItem(_('Wireless Off'));
      this.netctlOnMenuItem  = new PopupMenu.PopupMenuItem(_('Wireless On'));
      this.netctlOffMenuItem.connect('activate', Lang.bind(this, this._netctlOff));
      this.netctlOnMenuItem.connect('activate', Lang.bind(this, this._netctlOn));
      this.menu.addMenuItem(this.netctlOnMenuItem);
      this.menu.addMenuItem(this.netctlOffMenuItem);
   },

   _add_profile_menu_item: function(profile) {
      if(! profile.match(/\*.*/g)) {
         let menuItem = new PopupMenu.PopupMenuItem(profile);
         this.menu.addMenuItem(menuItem);
         menuItem.connect('activate', Lang.bind(this, function() {
            this._switch_to_profile(profile);
         }));
      } else {
         this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_(profile)));
      }
   },

   _set_icon: async function(){
      if((await this._get_connected_networks()) == null){
          this.icon.icon_name = NETWORK_OFFLINE;
      } else {
          this.icon.icon_name = NETWORK_CONNECTED;
      }
   },

   _refresh_details: function() {
      GLib.timeout_add_seconds(0, REFRESH_TIME, Lang.bind(this, function () {
         if(enabled){
            this._set_icon();
            this._update_menu();
            return true;
         }
         else {
            return false;
         }
      }));
   }

});

let netctlSwitcher;
let enabled = false;

function init() {
}

function enable() {
   enabled = true
   netctlSwitcher = new NetctlSwitcher();
   Main.panel.addToStatusArea('NetctlSwitcher', netctlSwitcher);
}

function disable() {
   netctlSwitcher.destroy();
   enabled = false;
}

