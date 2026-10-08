import Vue from "vue";
import VueRouter from "vue-router";
import Home from "../views/Home.vue";
import ComeSitTool from "../views/ComeSitTool.vue";
import TestPage from "../views/TestPage.vue";
import HouseTool from "../views/HouseTool.vue";
import ShapeDemo from "../views/ShapeDemo.vue";
import CalendarPage from "../views/CalendarPage.vue";

Vue.use(VueRouter);

const routes = [
  {
    path: "/Home",
    name: "Home",
    component: Home,
  },
  {
    path: "/",
    name: "ComeSitTool",
    component: ComeSitTool,
  },
  {
    path: "/TestPage",
    name: "TestPage",
    component: TestPage,
  },
  {
    path: "/HouseTool",
    name: "HouseTool",
    component: HouseTool,
  },
  {
    path: "/ShapeDemo",
    name: "ShapeDemo",
    component: ShapeDemo,
  },
  {
    path: "/Calendar",
    name: "Calendar",
    component: CalendarPage,
  },
];

const router = new VueRouter({
  mode: "history",
  base: process.env.BASE_URL,
  routes,
});

export default router;
