import { Router, type IRouter } from "express";
import healthRouter from "./health";
import promptBoloRouter from "./promptbolo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(promptBoloRouter);

export default router;
