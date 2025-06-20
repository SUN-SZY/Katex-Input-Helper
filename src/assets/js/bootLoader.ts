
/*	Could not bring asynchronous version of easyui to work.
 *	jquery node_module working with ProvidePlugin.
 */
import './jquery-easyui/jquery.easyui.min';
import './jquery-easyui/datagrid-dnd';
import './jquery-easyui/datagrid-filter';
import './jquery-easyui/datagrid-cellediting';

import MobileDetect from 'mobile-detect';
const CodeMirror = (await import('codemirror')).default;

import { Observable } from './patterns/observable';
import { Localizer } from './localization';
import { Themes } from './themes';
import { ParserExtension } from './parserExtension';
import { KIHParameters } from './parameters';
import { MathFormulae } from './math';
import { KatexInputHelper } from './dialog';
import { FileHandler } from './fileHandling';
import { CategoriesTree } from './categoriesTree';
import { DynamicPanel } from './panels';

import { injectable, inject, Factory } from 'inversify';
import { IBootLoader, IKatexInputHelper, katexInputHelperFactoryId } from './interfaces';

/**
 * The boot loader of the Katex Input Helper.
 * 
 * It serves as entry point of the application.
 */
@injectable()
export class BootLoader implements IBootLoader {
	
	baseLocation = null;
	factory: Factory<IKatexInputHelper> = null;
	vme: IKatexInputHelper = null;
	katex = null;
	
	/**
	 * Constructor.
	 */
	constructor(
		@inject(katexInputHelperFactoryId) factory
	) {
		this.factory = factory;
	}

	/**
	 * Converts a method with given signature and callback to a Promise returning method.
	 * 
	 * A special case is the use of setTimeout, where the order of arguments is swapped.
	 * 
	 * @async implements the Promise contract
	 * @param fnc - a function object to be invoked
	 * @param args - args of the function. The function has one additional callback parameter
	 * @returns the Promise, will be fulfilled if the callback is invoked
	 */
	async promisify(fnc: any, ...args: any[]) {
		return new Promise(function(resolve, reject) {
			try {
				function resolveFunc() {
					let msg = `Promise check: ${args} `;
					console.debug(msg);
					resolve('Success');
				}
				
				if (fnc === setTimeout) {
					setTimeout(function() {
						resolveFunc();
					}, ...args);
				} else {
					fnc(...args, function() {
						resolveFunc();
					});
				}
			} catch(err) {
				console.error(`Error occurred: ${err} `);		
				reject(Error(err));
			}		
		});
	}
	
	/**
	 * The promise is fulfilled if the document becomes ready.
	 * 
	 * @async implements the Promise contract
	 */
	async readyAsync() {
		let doc = $(document);
		return this.promisify(doc.ready.bind(doc));
	}
	
	/**
	 * The promise is fulfilled after a timeout is elapsed.
	 * 
	 * @async implements the Promise contract
	 * @param delay - the time in ms to wait for
	 */
	async setTimeoutAsync(delay: number) {
		return this.promisify(setTimeout, delay);
	}
	
	/**
	 * Checks if running device is mobile device.
	 * 
	 * @returns - Flag indicating a Mobile device
	 */
	platformInfo() : any {
		// Not reliable -> overridden in app
		let md = new MobileDetect(navigator.userAgent);
		let mobile = md.mobile() != null;
		let osFamily = md.os() ?? 'desktop';
		 
		return { isMobile: mobile, osFamily: osFamily };
	}
	
	/**
	 * Initializes the app.
	 * 
	 * This is the true application logic.
	 * 
	 * @async implements the Promise contract
	 */
	async initApp() {
		try {
			this.vme = this.factory();
			window.vme = this.vme;											// prevents garbage collection?
			await this.vme.initialise();
			$('#myContainer').layout({fit: true});
			$('#divEquationInputOutput').layout({});
		} finally {
			console.info('App initialization finished');
		}
	}
	
	/**
	 * Initialization scenario 1 : without easy loader.
	 * 
	 * @async implements the Promise contract
	 */
	async init1() {
		
		this.katex = await import('katex/dist/katex');			// This version of import is essential for mhchem
		await import('katex/dist/contrib/mhchem');
		let counter = 20;
		while (!this.presenceCheck(counter) && --counter >= 0) {
			await this.setTimeoutAsync(100);
		}
		console.info(`jquery loaded : ${typeof $} `);
		
		await this.readyAsync();
		console.debug('Promise check : document ready.');
		
		await this.initApp();
		console.debug('Promise check : app started.');
		this.check();
	}
	
	/**
	 * Checks the presence of the required scripts.
	 * 
	 * Checks until the cycle number becomes 0 (count down).
	 * 
	 * @param cycle - the current cycle
	 * @returns true, if all dependencies are loaded
	 * @throws if no cycle is left over and not all dependencies are loaded
	 */
	presenceCheck(cycle: number) {
		let lastChecked = 'Test';
		
		/**
		 * Checks the classname. Changed to accomodate the minification.
		 */
		function checkTypeByName(type: any, name: string, readableName = name) {
			lastChecked = readableName;
			if (type === undefined || type === null || (typeof type) === 'undefined' || !type.prototype) {
				console.warn(`Undefined type : ${readableName}`);
				return false;
			}
			let detectedName = type.prototype["constructor"]["name"];
			let equal = (detectedName === name);
			if (!equal && !PRODUCTION) {
				console.warn(`Type check failed : ${detectedName} : ${readableName}`);
				return false;
			}
			return true;								// returning test result can lead to problems with minimized versions of code
		}
		
		/**
		 * Checks some type of an object like 'object' or 'function'
		 */
		function checkOther(type: string, name: string, readableName: string) {
			lastChecked = readableName;
			let equal = type === name;
			if (!equal) {
				console.warn(`Type check failed : ${type} : ${readableName}`);
			}
			return equal;
		}
		
		/**
		 * Checks if katex can execute chemical formula.
		 * Deactivated, because not reliable.
		 */
		function mhchemCheck() {
			try {
				lastChecked = "Mhchem";
				this.katex.renderToString("\\ce{SO4^2- + Ba^2+ -> BaSO4 v} ", { throwOnError: true });
				return true;
			} catch(e) {
				console.warn(`Presence check failed : Mhchem`);
				return false;
			}
		}
		
		let allLoaded = (
			checkOther(typeof $, 'function', 'jquery') &&
			checkOther(typeof $.messager, 'object', 'easyui') &&
			checkOther(typeof $.fn.datagrid, 'function', 'datagrid') &&
			checkOther(typeof $.fn.datagrid.defaults, 'object', 'datagrid') &&
			checkOther(typeof $.fn.datagrid.defaults.defaultFilterOptions, 'object', 'datagrid-filter') &&
			// Can we independantly check dnd and cellediting?
			checkOther(typeof this.katex, 'object', 'Katex') &&
			checkOther(typeof this.katex.renderToString, 'function', 'Katex') &&
			// Can we do this check?
			//mhchemCheck() &&
			
			checkTypeByName(CodeMirror, 'CodeMirror', 'CodeMirror') &&
			
			checkTypeByName(Observable, 'Observable') &&
			checkTypeByName(Localizer, 'Localizer') &&
			checkTypeByName(Themes, 'Themes') &&
			checkTypeByName(ParserExtension, 'ParserExtension') &&
			checkTypeByName(KIHParameters, 'KIHParameters') &&
			checkTypeByName(FileHandler, 'FileHandler') &&
			checkTypeByName(MathFormulae, 'MathFormulae') &&
			checkTypeByName(CategoriesTree, 'CategoriesTree') &&
			checkTypeByName(DynamicPanel, 'DynamicPanel') &&
			checkTypeByName(KatexInputHelper, 'KatexInputHelper'));
		
		if (! allLoaded && cycle <= 0) {
			throw Error(`${lastChecked} not loaded`);
		}
			
		return allLoaded;
	}

	/**
	 * Performs a check about the presence of certain Html objects and provides
	 * console report.
	 */
	check() {
		let ids = [
			'html',
			'head',
			'body',
			'#bodyPage',
			'#myContainer',
			'.easyui-layout', 
			'.easyui-menubutton',
			'.easyui-dialog',
		];
		for (let id of ids) {
			$(id)
			.each(function() {
				console.debug(`Element check : ${$(this).prop('tagName')} : ${$(this).attr('id')} `);
			});
		}
	}

	/**
	 * Displays an alert message in case of a crash.
	 */
	fatal(err: any) {
		alert('The Katex Input Helper could not be opened properly, \n' + 
			`(${err}). \nPlease close it and open it again!`);
	}
}	

// This helps to import symbols in test suite
try {
	module.exports = BootLoader;
} catch(e) { }
