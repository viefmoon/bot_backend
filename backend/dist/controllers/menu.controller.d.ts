import { MenuService } from "../services/menu.service";
export declare class MenuController {
    private readonly menuService;
    constructor(menuService: MenuService);
    getMenu(): Promise<any>;
}
